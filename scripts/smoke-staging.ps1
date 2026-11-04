<#
.SYNOPSIS
  Read-only smoke checks against the DEPLOYED staging site and backend. Windows PowerShell 5.1 and PowerShell 7 compatible.
  Only talks to ugc-mock-test-staging URLs. Sends no credentials, creates no accounts, writes no data.

.DESCRIPTION
  1. Hosting: landing page, staging banner text in the HTML, X-Robots-Tag noindex header, robots.txt, key routes.
  2. Functions: publicConfig reports staging / payments off / live AI off; protected callables refuse unauthenticated callers.
  3. Firestore rules (REST, unauthenticated): answer keys, leads and unfiltered test lists are refused; the public catalogue is readable.
  Interactive checks (sign-up, exam, results...) are in docs/DEPLOY_RUNBOOK_STAGING.md section 7.
#>
[CmdletBinding()]
param(
  # For testing this script itself against a local fake server. Only loopback http addresses are accepted.
  [string]$TestSiteBase = '',
  [string]$TestFunctionsBase = '',
  [string]$TestFirestoreBase = ''
)
$ErrorActionPreference = 'Continue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$Project = 'ugc-mock-test-staging'
$Site = "https://$Project.web.app"
$FnBase = "https://asia-south1-$Project.cloudfunctions.net"
$Fs = "https://firestore.googleapis.com/v1/projects/$Project/databases/(default)/documents"
foreach ($pair in @(@('TestSiteBase', $TestSiteBase), @('TestFunctionsBase', $TestFunctionsBase), @('TestFirestoreBase', $TestFirestoreBase))) {
  if ($pair[1] -and $pair[1] -notmatch '^http://127\.0\.0\.1:\d+') { throw "-$($pair[0]) accepts only http://127.0.0.1:PORT addresses." }
}
if ($TestSiteBase) { $Site = $TestSiteBase }
if ($TestFunctionsBase) { $FnBase = $TestFunctionsBase }
if ($TestFirestoreBase) { $Fs = $TestFirestoreBase }
$Results = New-Object System.Collections.ArrayList

function Http([string]$Method, [string]$Url, [string]$Body = $null) {
  $o = @{ Uri = $Url; Method = $Method; UseBasicParsing = $true; TimeoutSec = 60 }
  if ($Body) { $o.Body = $Body; $o.ContentType = 'application/json' }
  try {
    $r = Invoke-WebRequest @o
    return @{ Status = [int]$r.StatusCode; Headers = $r.Headers; Body = [string]$r.Content }
  } catch {
    $resp = $_.Exception.Response
    $text = ''
    try {
      if ($resp -is [System.Net.HttpWebResponse]) { $text = (New-Object System.IO.StreamReader($resp.GetResponseStream())).ReadToEnd() }
      elseif ($_.ErrorDetails -and $_.ErrorDetails.Message) { $text = $_.ErrorDetails.Message }
    } catch { }
    if ($resp) { return @{ Status = [int]$resp.StatusCode; Headers = $resp.Headers; Body = $text } }
    return @{ Status = 0; Headers = @{}; Body = $_.Exception.Message }
  }
}
function Check([string]$Name, [bool]$Ok, [string]$Detail = '') {
  [void]$Results.Add(@{ Name = $Name; Ok = $Ok })
  $tag = if ($Ok) { 'PASS' } else { 'FAIL' }
  $colour = if ($Ok) { 'Green' } else { 'Red' }
  Write-Host ("{0}  {1}  {2}" -f $tag, $Name, $Detail) -ForegroundColor $colour
}
function HeaderValue($Headers, [string]$Name) { try { return [string]($Headers[$Name]) } catch { return '' } }

Write-Host "Smoke test target: $Site  (project $Project)"
Write-Host ""

# ---- Hosting
$landing = Http 'GET' "$Site/"
Check 'Landing page loads (HTTP 200)' ($landing.Status -eq 200) "status $($landing.Status)"
Check 'Staging banner text is in the page' ($landing.Body -match 'Staging preview') ''
Check 'X-Robots-Tag header contains noindex' ((HeaderValue $landing.Headers 'X-Robots-Tag') -match 'noindex') (HeaderValue $landing.Headers 'X-Robots-Tag')
Check 'Content-Security-Policy header present' ((HeaderValue $landing.Headers 'Content-Security-Policy') -ne '') ''
$robots = Http 'GET' "$Site/robots.txt"
Check 'robots.txt disallows crawling' ($robots.Status -eq 200 -and $robots.Body -match 'Disallow:\s*/') "status $($robots.Status)"
foreach ($route in @('/login', '/signup', '/syllabus', '/pricing', '/disclaimer', '/app', '/admin')) {
  $r = Http 'GET' "$Site$route"
  Check "Route $route is served" ($r.Status -eq 200) "status $($r.Status)"
}
Check 'Landing page does not mention the mock test backend' ($landing.Status -eq 200 -and -not ($landing.Body -match 'ur_mock_session|Test build only')) ''

# ---- Functions (callable protocol: POST {"data": ...} -> {"result": ...} or {"error": ...})
$cfg = Http 'POST' "$FnBase/publicConfig" '{"data":{}}'
Check 'publicConfig answers (HTTP 200)' ($cfg.Status -eq 200) "status $($cfg.Status)"
if ($cfg.Status -eq 200) {
  $j = $null
  try { $j = $cfg.Body | ConvertFrom-Json } catch { }
  Check 'publicConfig: environment is staging' ($j -and $j.result.env -eq 'staging') ''
  Check 'publicConfig: payments are disabled' ($j -and $j.result.paymentsEnabled -eq $false) ''
  Check 'publicConfig: live AI is disabled' ($j -and $j.result.aiLive -eq $false) ''
  Check 'publicConfig: payment mode is test' ($j -and $j.result.paymentMode -eq 'test') ''
}
foreach ($fn in @('startExam', 'submitExam', 'getExamResult', 'adminList', 'adminOverview', 'assignRole', 'claimOwner', 'createOrder')) {
  $r = Http 'POST' "$FnBase/$fn" '{"data":{}}'
  Check "$fn refuses an unauthenticated caller" ($r.Status -eq 401 -or $r.Status -eq 403) "status $($r.Status)"
}

# ---- Firestore rules, unauthenticated REST (a denied request is the expected, healthy outcome)
foreach ($p in @('answerKeys/probe', 'publishedPapers/probe', 'questions/probe', 'leads/probe', 'auditLogs/probe', 'systemSettings/_reportKey', 'users/probe', 'examSessions/probe', 'mockTests')) {
  $r = Http 'GET' "$Fs/$p"
  Check "Firestore refuses unauthenticated read of $p" ($r.Status -eq 403) "status $($r.Status)"
}
$cat = Http 'GET' "$Fs/subjects?pageSize=1"
Check 'Firestore allows the public catalogue (subjects)' ($cat.Status -eq 200) "status $($cat.Status)"

$bad = @($Results | Where-Object { -not $_.Ok }).Count
Write-Host ""
Write-Host ("{0} of {1} smoke checks passed" -f ($Results.Count - $bad), $Results.Count)
if ($bad -gt 0) { exit 1 }
exit 0
