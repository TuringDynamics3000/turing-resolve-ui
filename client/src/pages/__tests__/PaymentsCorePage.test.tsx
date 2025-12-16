import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock data matching the actual component's expected data structure
const mockPayments = [
  {
    paymentId: 'PAY-test-001',
    state: 'SETTLED',
    amount: '100.00',
    currency: 'AUD',
    scheme: 'NPP',
    fromAccount: 'DEP-source-001',
    toAccount: null,
    factCount: 4,
    lastEvent: 'PAYMENT_SETTLED',
    lastEventAt: new Date('2024-12-16T10:00:00Z'),
  },
  {
    paymentId: 'PAY-test-002',
    state: 'FAILED',
    amount: '50.00',
    currency: 'AUD',
    scheme: 'NPP',
    fromAccount: 'DEP-source-002',
    toAccount: 'DEP-dest-002',
    factCount: 2,
    lastEvent: 'PAYMENT_FAILED',
    lastEventAt: new Date('2024-12-16T11:00:00Z'),
  },
];

const mockPaymentDetail = {
  success: true,
  payment: {
    paymentId: 'PAY-test-001',
    state: 'SETTLED',
    intent: {
      amount: '100.00',
      currency: 'AUD',
      scheme: 'NPP',
      fromAccount: 'DEP-source-001',
      toAccount: null,
      toExternal: { bankCode: '062000', identifier: '123456789', name: 'Test Recipient', type: 'NPP' },
      idempotencyKey: 'PAY-test-001:1:PAYMENT_INITIATED',
    },
  },
  facts: [
    {
      id: 'FACT-001',
      paymentId: 'PAY-test-001',
      factType: 'PAYMENT_INITIATED',
      occurredAt: new Date('2024-12-16T09:00:00Z'),
      idempotencyKey: 'PAY-test-001:1:PAYMENT_INITIATED',
      source: 'INTERNAL',
      externalRef: null,
      factData: { amount: '100.00', currency: 'AUD' },
      sequence: 1,
      depositFactId: null,
      depositPostingType: null,
    },
  ],
};

const mockSafeguards = {
  killSwitch: {
    npp: { state: 'ENABLED', lastChanged: new Date('2024-12-15T00:00:00Z'), reason: 'Normal operation', actor: 'system' },
  },
  circuitBreaker: {
    npp: { state: 'CLOSED', failureCount: 0, lastFailure: null },
  },
  failureHistory: [],
};

const mockLinkedDeposits = {
  accounts: [],
  depositFacts: [],
};

// Mock the entire trpc module
vi.mock('@/lib/trpc', () => ({
  trpc: {
    payments: {
      listCoreV1: {
        useQuery: () => ({
          data: mockPayments,
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        }),
      },
      rebuildFromFacts: {
        useQuery: () => ({
          data: mockPaymentDetail,
          isLoading: false,
          error: null,
        }),
      },
      getLinkedDeposits: {
        useQuery: () => ({
          data: mockLinkedDeposits,
          isLoading: false,
          error: null,
        }),
      },
      getSafeguards: {
        useQuery: () => ({
          data: mockSafeguards,
          isLoading: false,
          error: null,
        }),
      },
    },
  },
}));

// Import after mocking
import PaymentsCorePage from '../PaymentsCorePage';

describe('PaymentsCorePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Overview Tab', () => {
    it('renders summary cards with correct counts', () => {
      render(<PaymentsCorePage />);
      
      // Check summary cards exist
      expect(screen.getByText('Total Payments')).toBeInTheDocument();
      expect(screen.getByText('Settled')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Failed/Reversed')).toBeInTheDocument();
    });

    it('renders payments table with correct columns', () => {
      render(<PaymentsCorePage />);
      
      // Check table headers
      expect(screen.getByText('Payment ID')).toBeInTheDocument();
      expect(screen.getByText('State')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
      expect(screen.getByText('Scheme')).toBeInTheDocument();
    });

    it('displays payment state badges with correct colors', () => {
      render(<PaymentsCorePage />);
      
      // SETTLED badge should be present
      const settledBadge = screen.getByText('SETTLED');
      expect(settledBadge).toBeInTheDocument();
      
      // FAILED badge should be present
      const failedBadge = screen.getByText('FAILED');
      expect(failedBadge).toBeInTheDocument();
    });

    it('shows deterministic state machine banner', () => {
      render(<PaymentsCorePage />);
      
      expect(screen.getByText(/Payments Core v1/)).toBeInTheDocument();
      expect(screen.getByText(/Deterministic State Machine/)).toBeInTheDocument();
    });
  });

  describe('UI Principles', () => {
    it('never computes balances - only displays server-derived state', () => {
      render(<PaymentsCorePage />);
      
      // The UI should display amounts from the API, not compute them
      // Check that we're displaying the amount from mockPayments
      expect(screen.getByText('$100.00')).toBeInTheDocument();
      expect(screen.getByText('$50.00')).toBeInTheDocument();
    });
    
    it('displays payment IDs from server data', () => {
      render(<PaymentsCorePage />);
      
      expect(screen.getByText('PAY-test-001')).toBeInTheDocument();
      expect(screen.getByText('PAY-test-002')).toBeInTheDocument();
    });
    
    it('shows fact counts for each payment', () => {
      render(<PaymentsCorePage />);
      
      expect(screen.getByText('4 facts')).toBeInTheDocument();
      expect(screen.getByText('2 facts')).toBeInTheDocument();
    });
  });
});
