'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Filter,
  History,
  LifeBuoy,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  Zap,
} from 'lucide-react';
import {
  DEPT_LABELS,
  type SmartTicket,
  type TicketSeverity,
  type TicketStatus,
} from '@ureducator/shared';
import {
  Button,
  Dialog,
  PageHeader,
  Select,
  Sheet,
  Spinner,
  Textarea,
  toast,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getClientFirestore } from '@/lib/backend.firebase';
import { useDocumentTitle, fmtDateTime } from '@/lib/hooks';
import { cn } from '@/lib/cn';
import {
  fetchTicketsAction,
  runEscalationCheckAction,
  updateTicketStatusAction,
} from '@/app/actions/tickets';

export default function SupportDeskPage() {
  useDocumentTitle('Support Desk — UrEducator Admin');
  const { user } = useAuth();

  const [tickets, setTickets] = useState<SmartTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [escalating, setEscalating] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // Status update modal state
  const [editingTicket, setEditingTicket] = useState<SmartTicket | null>(null);
  const [newStatus, setNewStatus] = useState<TicketStatus>('INVESTIGATING');
  const [statusNote, setStatusNote] = useState('');
  const [updating, setUpdating] = useState(false);

  // History timeline modal state
  const [historyTicket, setHistoryTicket] = useState<SmartTicket | null>(null);

  // Real-time listener for tickets
  useEffect(() => {
    let unsub = () => {};
    try {
      const db = getClientFirestore();
      const q = query(collection(db, 'tickets'), orderBy('createdAtMs', 'desc'));
      unsub = onSnapshot(
        q,
        (snapshot) => {
          const list = snapshot.docs.map((doc) => doc.data() as SmartTicket);
          setTickets(list);
          setLoading(false);
        },
        async (err) => {
          console.warn('[SupportDesk] onSnapshot warning, falling back to Server Action:', err);
          const res = await fetchTicketsAction();
          if (res.success) {
            setTickets(res.tickets);
          }
          setLoading(false);
        }
      );
    } catch {
      void fetchTicketsAction().then((res) => {
        if (res.success) setTickets(res.tickets);
        setLoading(false);
      });
    }
    return () => unsub();
  }, []);

  const handleManualEscalationCheck = async () => {
    setEscalating(true);
    try {
      const res = await runEscalationCheckAction();
      if (res.success) {
        if (res.escalatedCount > 0) {
          toast({
            title: `Escalation Complete: ${res.escalatedCount} Ticket(s) Escalated`,
            description: `Escalated IDs: ${res.escalatedTicketIds.join(', ')}. On-call team alerted.`,
            tone: 'warn',
            durationMs: 8000,
          });
        } else {
          toast({
            title: 'SLA Audit Clear',
            description: `Scanned ${res.totalChecked} open tickets. None exceeded the 24h SLA threshold.`,
            tone: 'ok',
            durationMs: 5000,
          });
        }
      } else {
        toast({
          title: 'Escalation Check Failed',
          description: res.error || 'Could not complete scan',
          tone: 'error',
        });
      }
    } catch (e) {
      toast({
        title: 'Escalation Check Failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        tone: 'error',
      });
    } finally {
      setEscalating(false);
    }
  };

  const handleOpenStatusModal = (ticket: SmartTicket) => {
    setEditingTicket(ticket);
    setNewStatus(ticket.status);
    setStatusNote('');
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTicket) return;
    setUpdating(true);
    try {
      const res = await updateTicketStatusAction({
        ticketId: editingTicket.ticketId,
        status: newStatus,
        staffUid: user?.uid || 'admin_user',
        staffRole: user?.role || 'admin',
        note: statusNote.trim() || undefined,
      });

      if (res.success) {
        toast({
          title: `Status Updated: ${editingTicket.ticketId}`,
          description: `Changed from ${editingTicket.status} to ${newStatus}`,
          tone: 'ok',
        });
        setEditingTicket(null);
      } else {
        toast({
          title: 'Update Failed',
          description: res.error || 'Could not update ticket',
          tone: 'error',
        });
      }
    } catch (e) {
      toast({
        title: 'Update Error',
        description: e instanceof Error ? e.message : 'Unknown error',
        tone: 'error',
      });
    } finally {
      setUpdating(false);
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === 'OPEN').length;
    const investigating = tickets.filter((t) => t.status === 'INVESTIGATING').length;
    const escalated = tickets.filter((t) => t.status === 'ESCALATED').length;
    const resolved = tickets.filter((t) => t.status === 'RESOLVED').length;
    const l1Count = tickets.filter((t) => t.severity === 'L1' && t.status !== 'RESOLVED').length;
    return { total, open, investigating, escalated, resolved, l1Count };
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (deptFilter !== 'ALL' && t.dept !== deptFilter) return false;
      if (severityFilter !== 'ALL' && t.severity !== severityFilter) return false;
      if (search.trim()) {
        const queryStr = search.toLowerCase();
        const matchesId = t.ticketId.toLowerCase().includes(queryStr);
        const matchesEmail = (t.studentEmail || '').toLowerCase().includes(queryStr);
        const matchesTitle = t.title.toLowerCase().includes(queryStr);
        const matchesDesc = t.description.toLowerCase().includes(queryStr);
        if (!matchesId && !matchesEmail && !matchesTitle && !matchesDesc) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, deptFilter, severityFilter, search]);

  const getSeverityBadge = (severity: TicketSeverity) => {
    switch (severity) {
      case 'L1':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-bad-soft px-2 py-0.5 text-xs font-bold text-bad border border-bad/30">
            <AlertCircle className="size-3" /> L1 Critical
          </span>
        );
      case 'L2':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-marker-soft px-2 py-0.5 text-xs font-bold text-ink border border-[#d9b640]">
            <AlertTriangle className="size-3" /> L2 Standard
          </span>
        );
      case 'L3':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-paper px-2 py-0.5 text-xs font-medium text-muted border border-line">
            L3 Minor
          </span>
        );
    }
  };

  const getStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-pen-50 px-2.5 py-0.5 text-xs font-bold text-pen-700 border border-pen-200">
            <Clock className="size-3" /> OPEN
          </span>
        );
      case 'INVESTIGATING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <RefreshCw className="size-3 animate-spin" /> INVESTIGATING
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-bad-soft px-2.5 py-0.5 text-xs font-bold text-bad border border-bad animate-pulse">
            <ShieldAlert className="size-3" /> ESCALATED ({'>'}24h)
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-bold text-ok border border-[#8ccaae]">
            <CheckCircle2 className="size-3" /> RESOLVED
          </span>
        );
    }
  };

  return (
    <>
      <PageHeader
        title="Support Desk & Escalation Engine"
        intro="Real-time incident response, semantic diagnostic codes, and automated SLA breach escalation."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleManualEscalationCheck}
              busy={escalating}
              className="gap-2"
              title="Audit tickets exceeding 24 hours in OPEN state"
            >
              <Zap className="size-4 text-marker" />
              Run 24h SLA Escalation Sweep
            </Button>
          </div>
        }
      />

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-6">
        <Sheet className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Tickets</p>
          <p className="mt-1 text-2xl font-bold text-ink">{metrics.total}</p>
        </Sheet>
        <Sheet className="p-4 border-pen-200 bg-pen-50/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-pen-700">Open</p>
          <p className="mt-1 text-2xl font-bold text-pen-700">{metrics.open}</p>
        </Sheet>
        <Sheet className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Investigating</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{metrics.investigating}</p>
        </Sheet>
        <Sheet className="p-4 border-bad/30 bg-bad-soft/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-bad">Escalated (SLA)</p>
          <p className="mt-1 text-2xl font-bold text-bad">{metrics.escalated}</p>
        </Sheet>
        <Sheet className="p-4 border-[#8ccaae] bg-ok-soft/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-ok">Resolved</p>
          <p className="mt-1 text-2xl font-bold text-ok">{metrics.resolved}</p>
        </Sheet>
        <Sheet className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Active Blockers (L1)</p>
          <p className="mt-1 text-2xl font-bold text-ink">{metrics.l1Count}</p>
        </Sheet>
      </div>

      {/* Filter and Search Bar */}
      <Sheet className="p-4 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted" />
            <input
              type="text"
              placeholder="Search by Ticket ID (e.g., PAY-L1-FAIL), email, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-control border border-line-strong bg-surface pl-9 pr-4 py-2 text-sm text-ink placeholder:text-muted focus-visible:border-pen-500 focus-visible:ring-1 focus-visible:ring-pen-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Filter className="size-3.5" /> Filters:
            </div>

            {/* Status Filter */}
            <select
              aria-label="Filter by Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-xs text-ink font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="INVESTIGATING">INVESTIGATING</option>
              <option value="ESCALATED">ESCALATED</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>

            {/* Department Filter */}
            <select
              aria-label="Filter by Department"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-xs text-ink font-medium"
            >
              <option value="ALL">All Depts</option>
              <option value="PAY">PAY (Billing)</option>
              <option value="EXM">EXM (Mock Tests)</option>
              <option value="ACC">ACC (Auth)</option>
              <option value="SYS">SYS (Platform)</option>
            </select>

            {/* Severity Filter */}
            <select
              aria-label="Filter by Severity"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-xs text-ink font-medium"
            >
              <option value="ALL">All Severities</option>
              <option value="L1">L1 (Critical)</option>
              <option value="L2">L2 (Standard)</option>
              <option value="L3">L3 (Minor)</option>
            </select>

            {(statusFilter !== 'ALL' || deptFilter !== 'ALL' || severityFilter !== 'ALL' || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('ALL');
                  setDeptFilter('ALL');
                  setSeverityFilter('ALL');
                  setSearch('');
                }}
                className="text-xs h-8 px-2"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </Sheet>

      {/* Ticket List */}
      {loading ? (
        <Spinner label="Loading tickets from Firestore..." />
      ) : filteredTickets.length === 0 ? (
        <Sheet className="p-12 text-center">
          <LifeBuoy className="mx-auto size-10 text-muted/60" />
          <h3 className="mt-3 text-lg font-semibold text-ink">No Tickets Found</h3>
          <p className="mt-1 text-sm text-muted">
            {tickets.length === 0
              ? 'No support tickets have been submitted yet.'
              : 'No tickets match the selected filters.'}
          </p>
        </Sheet>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((t) => {
            const ageHours = Math.round((Date.now() - t.createdAtMs) / 3600000);
            const isOverdue = t.status === 'OPEN' && ageHours >= 24;

            return (
              <Sheet
                key={t.ticketId}
                className={cn(
                  'p-5 transition-shadow hover:shadow-sm',
                  t.status === 'ESCALATED' && 'border-bad/40 bg-bad-soft/10',
                  isOverdue && 'border-amber-500/40 bg-marker-soft/10'
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left Column: ID, Badges & Title */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-pen-700 bg-pen-50 px-2 py-0.5 rounded border border-pen-200">
                        {t.ticketId}
                      </span>
                      {getSeverityBadge(t.severity)}
                      {getStatusBadge(t.status)}
                      <span className="text-xs text-muted font-medium">
                        Dept: <span className="font-semibold text-ink">{t.dept}</span> ({DEPT_LABELS[t.dept]})
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-ink leading-snug">{t.title}</h3>
                      <p className="mt-1 text-sm text-muted line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted pt-1">
                      <span className="flex items-center gap-1 font-medium">
                        <User className="size-3.5" />
                        {t.studentEmail || t.studentName || t.studentUid}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {fmtDateTime(t.createdAtMs)} ({ageHours}h ago)
                      </span>
                      {isOverdue && (
                        <span className="font-bold text-bad flex items-center gap-1">
                          ⚠️ Exceeded 24h SLA
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setHistoryTicket(t)}
                      className="gap-1.5 text-xs h-9"
                      title="View audit history"
                    >
                      <History className="size-3.5" />
                      History ({t.history?.length || 0})
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleOpenStatusModal(t)}
                      className="gap-1.5 text-xs h-9"
                    >
                      <ArrowUpDown className="size-3.5" />
                      Update Status
                    </Button>
                  </div>
                </div>
              </Sheet>
            );
          })}
        </div>
      )}

      {/* Status Update Dialog */}
      <Dialog
        open={!!editingTicket}
        onClose={() => !updating && setEditingTicket(null)}
        title={
          <div className="flex items-center gap-2">
            <RefreshCw className="size-5 text-pen-700" />
            <span>Update Ticket Status</span>
          </div>
        }
      >
        {editingTicket && (
          <form onSubmit={handleSaveStatus} className="space-y-4">
            <div className="rounded-control border border-line bg-paper p-3 text-xs">
              <p className="font-mono font-bold text-ink">{editingTicket.ticketId}</p>
              <p className="font-semibold text-muted mt-0.5">{editingTicket.title}</p>
              <div className="mt-2 flex items-center gap-2">
                <span>Current Status:</span>
                {getStatusBadge(editingTicket.status)}
              </div>
            </div>

            <Select
              label="New Status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
            >
              <option value="OPEN">OPEN (Pending assignment)</option>
              <option value="INVESTIGATING">INVESTIGATING (Actively in progress)</option>
              <option value="ESCALATED">ESCALATED (Trigger on-call lead alert)</option>
              <option value="RESOLVED">RESOLVED (Issue addressed & closed)</option>
            </Select>

            <Textarea
              label="Internal Staff Note"
              placeholder="e.g., Verified UPI reference number, manually restored subscription entitlements..."
              rows={3}
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              hint="This note will be recorded in the audit history."
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingTicket(null)}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" busy={updating}>
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* History Timeline Dialog */}
      <Dialog
        open={!!historyTicket}
        onClose={() => setHistoryTicket(null)}
        title={
          <div className="flex items-center gap-2">
            <History className="size-5 text-pen-700" />
            <span>Ticket Audit Timeline</span>
          </div>
        }
      >
        {historyTicket && (
          <div className="space-y-4">
            <div className="rounded-control border border-line bg-paper p-3 text-xs">
              <span className="font-mono font-bold text-ink">{historyTicket.ticketId}</span>
              <p className="font-semibold text-muted mt-0.5">{historyTicket.title}</p>
            </div>

            <div className="relative border-l-2 border-line pl-4 space-y-4 my-2">
              {(historyTicket.history || []).map((h, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-pen-700 ring-4 ring-surface" />
                  <div className="flex items-center gap-2">
                    {getStatusBadge(h.status)}
                    <span className="text-xs text-muted">{fmtDateTime(h.timestamp)}</span>
                  </div>
                  {h.note && (
                    <p className="mt-1 text-xs text-ink font-medium leading-relaxed bg-surface-hover/50 p-2 rounded border border-line/50">
                      {h.note}
                    </p>
                  )}
                  {h.updatedBy && (
                    <p className="mt-0.5 text-[11px] text-muted">By: {h.updatedBy}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-line">
              <Button variant="secondary" onClick={() => setHistoryTicket(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
