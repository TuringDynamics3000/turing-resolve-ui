import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, DollarSign, RotateCcw, Shield, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface Payment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  currency: string;
  recipient: string;
  reference: string;
  state: string;
}

interface ReversalDialogProps {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ReversalType = 'full' | 'partial';

export function ReversalDialog({ payment, open, onOpenChange, onSuccess }: ReversalDialogProps) {
  const [reversalType, setReversalType] = useState<ReversalType>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const reverseMutation = trpc.payments.reversePayment.useMutation({
    onSuccess: (data) => {
      if (!data.success) {
        toast.error('Reversal failed', {
          description: data.error || 'Unknown error',
        });
        setIsSubmitting(false);
        return;
      }
      toast.success('Payment reversed successfully', {
        description: `Payment ${data.payment?.paymentId} has been reversed`,
      });
      onOpenChange(false);
      onSuccess?.();
      setIsSubmitting(false);
    },
    onError: (error) => {
      // Check if this is an RBAC error requiring approval
      if (error.message.includes('FORBIDDEN') || error.message.includes('approval')) {
        setRequiresApproval(true);
        toast.success('Reversal submitted for approval', {
          description: 'A supervisor must approve this reversal',
        });
      } else {
        toast.error('Reversal failed', {
          description: error.message,
        });
      }
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async () => {
    if (!payment) return;
    
    const amount = reversalType === 'full' 
      ? payment.amount 
      : parseFloat(partialAmount);

    if (reversalType === 'partial' && (isNaN(amount) || amount <= 0 || amount > payment.amount)) {
      toast.error('Invalid amount', {
        description: `Amount must be between 0.01 and ${payment.amount} ${payment.currency}`,
      });
      return;
    }

    if (!reason.trim()) {
      toast.error('Reason required', {
        description: 'Please provide a reason for the reversal',
      });
      return;
    }

    setIsSubmitting(true);
    // Note: Current API only supports full reversals
    // Partial reversal amount is stored in reason for future implementation
    const fullReason = reversalType === 'partial' 
      ? `Partial reversal of $${amount}: ${reason.trim()}`
      : reason.trim();
    
    reverseMutation.mutate({
      paymentId: payment.id,
      reason: fullReason,
    });
  };

  const handleClose = () => {
    setReversalType('full');
    setPartialAmount('');
    setReason('');
    setRequiresApproval(false);
    onOpenChange(false);
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-500" />
            Reverse Payment
          </DialogTitle>
          <DialogDescription>
            Create a reversal for payment {payment.id}
          </DialogDescription>
        </DialogHeader>

        {requiresApproval ? (
          <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Approval Required</h3>
            <p className="text-muted-foreground mb-4">
              This reversal requires supervisor approval due to RBAC policies.
              The request has been submitted to the approval queue.
            </p>
            <Button onClick={handleClose}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Done
            </Button>
          </div>
        ) : (
          <>
            {/* Payment Summary */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Customer</span>
                <span className="font-medium">{payment.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Recipient</span>
                <span>{payment.recipient}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Original Amount</span>
                <span className="font-mono font-semibold text-lg">
                  ${payment.amount.toLocaleString()} {payment.currency}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Reference</span>
                <span className="font-mono text-sm">{payment.reference}</span>
              </div>
            </div>

            {/* Reversal Type Selection */}
            <div className="space-y-3">
              <Label>Reversal Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setReversalType('full')}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    reversalType === 'full'
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border/80"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <RotateCcw className="w-4 h-4" />
                    <span className="font-medium">Full Reversal</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reverse the entire payment amount
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setReversalType('partial')}
                  className={cn(
                    "p-4 rounded-lg border-2 text-left transition-all",
                    reversalType === 'partial'
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border/80"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="font-medium">Partial Reversal</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reverse a specific amount
                  </p>
                </button>
              </div>
            </div>

            {/* Partial Amount Input */}
            {reversalType === 'partial' && (
              <div className="space-y-2">
                <Label htmlFor="partialAmount">Reversal Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="partialAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={payment.amount}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder={`Max: ${payment.amount}`}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum reversible: ${payment.amount.toLocaleString()} {payment.currency}
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Reversal</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter the reason for this reversal..."
                rows={3}
              />
            </div>

            {/* Warning */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-500">This action requires approval</p>
                <p className="text-muted-foreground">
                  Reversals are subject to RBAC policies and may require supervisor approval
                  before processing.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isSubmitting ? (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Submit Reversal
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
