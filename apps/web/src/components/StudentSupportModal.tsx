'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  HelpCircle,
  LifeBuoy,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  CATEGORY_MAP,
  DEPT_LABELS,
  type TicketDept,
  type TicketSeverity,
} from '@ureducator/shared';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { submitTicketAction } from '@/app/actions/tickets';

export function StudentSupportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();

  const [category, setCategory] = useState<string>('payment');
  const [severity, setSeverity] = useState<TicketSeverity>('L1');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Update default severity when category changes
  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    const mapping = CATEGORY_MAP[newCat];
    if (mapping) {
      setSeverity(mapping.defaultSeverity);
    }
  };

  const currentMapping = CATEGORY_MAP[category] || {
    dept: 'SYS' as TicketDept,
    type: 'GENX',
    defaultSeverity: 'L2' as TicketSeverity,
    label: 'General Inquiry',
    description: '',
  };

  const previewPrefix = `${currentMapping.dept}-${severity}-${currentMapping.type}-****`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a short summary of the issue.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Please provide a descriptive explanation (at least 10 characters).');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await submitTicketAction({
        category,
        severity,
        title: title.trim(),
        description: description.trim(),
        studentUid: user?.uid || 'anonymous_student',
        studentEmail: user?.email || undefined,
        studentName: user?.displayName || undefined,
      });

      if (res.success && res.ticket) {
        setCreatedTicketId(res.ticket.ticketId);
      } else {
        setError(res.error || 'Failed to submit ticket. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyId = () => {
    if (createdTicketId) {
      void navigator.clipboard.writeText(createdTicketId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleModalClose = () => {
    if (!busy) {
      onClose();
      // Reset after closing animation
      setTimeout(() => {
        setCreatedTicketId(null);
        setTitle('');
        setDescription('');
        setError(null);
        setCategory('payment');
        setSeverity('L1');
      }, 300);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleModalClose}
      title={
        <div className="flex items-center gap-2">
          <LifeBuoy className="size-5 text-pen-700" />
          <span>Need Help? Student Support Desk</span>
        </div>
      }
    >
      {createdTicketId ? (
        <div className="space-y-5 py-2 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-ok-soft text-ok">
            <CheckCircle2 className="size-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-ink">Ticket Successfully Created!</h3>
            <p className="mt-1 text-sm text-muted">
              Your inquiry has been dispatched to our {DEPT_LABELS[currentMapping.dept]} team.
            </p>
          </div>

          <div className="mx-auto max-w-sm rounded-sheet border border-pen-200 bg-pen-50 p-4 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Semantic Ticket ID
              </span>
              <Badge variant="accent">{severity}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-base font-bold text-ink">{createdTicketId}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopyId}
                className="gap-1.5 h-8 text-xs"
              >
                <Copy className="size-3.5" />
                {copied ? 'Copied!' : 'Copy ID'}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">
              Quote this reference ID for any follow-up with academic mentors or administrators.
            </p>
          </div>

          <div className="pt-2">
            <Button variant="primary" onClick={handleModalClose} className="w-full">
              Done & Return to App
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted">
            Experiencing a payment issue, doubt regarding a question, or a platform bug? Submit a ticket below for immediate assistance.
          </p>

          {error && <Alert tone="error">{error}</Alert>}

          {/* Semantic ID Live Tag Preview */}
          <div className="flex items-center justify-between rounded-control border border-line bg-paper px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-pen-700" />
              <span className="font-semibold text-muted">Semantic Tag Preview:</span>
            </div>
            <span className="font-mono font-bold text-pen-700">{previewPrefix}</span>
          </div>

          {/* Category Dropdown */}
          <Select
            label="Category"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="payment">💳 Payment & Billing (PAY)</option>
            <option value="exam_content">📝 Exam Content & Questions (EXM)</option>
            <option value="login">🔐 Login & Account Access (ACC)</option>
            <option value="bug">🐛 Platform Bug & Glitch (SYS)</option>
          </Select>

          {/* Severity Dropdown */}
          <Select
            label="Urgency / Severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as TicketSeverity)}
            hint="L1 is prioritized immediately for blockers stopping study progress."
          >
            <option value="L1">🔴 L1 - Critical / Blocker (Cannot take exam / payment debited)</option>
            <option value="L2">🟡 L2 - Standard (Question clarification / explanation doubt)</option>
            <option value="L3">🟢 L3 - Minor (Feedback / typo / visual improvement)</option>
          </Select>

          {/* Subject / Title */}
          <Input
            label="Subject / Summary"
            placeholder="e.g., Payment debited but Premium Mock Test locked"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          {/* Issue Description */}
          <Textarea
            label="Detailed Description"
            rows={4}
            placeholder="Please describe what happened, including shift date or mock test name if applicable..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            hint={`${description.length}/5000 characters`}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              onClick={handleModalClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" busy={busy} className="gap-2">
              <Send className="size-4" />
              Submit Ticket
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/**
 * Floating Action Button (FAB) for Student Support.
 * Fixed in bottom-right corner of the student app view.
 */
export function SupportFab({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Need Help? Open Support Desk"
      aria-label="Need Help? Open Support Desk"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-pen-surface bg-pen-surface px-4 py-2.5 font-semibold text-pen-surface-ink shadow-lg transition-transform duration-150 hover:scale-105 active:scale-95 print:hidden cursor-pointer"
    >
      <HelpCircle className="size-5" />
      <span className="text-sm font-bold">Help & Support</span>
    </button>
  );
}
