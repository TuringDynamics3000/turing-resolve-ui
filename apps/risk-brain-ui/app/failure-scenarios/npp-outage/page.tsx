export default function NppOutageWalkthrough() {
  return (
    <div className="prose max-w-none">
      <h1>NPP Outage — Safe Failure Walkthrough</h1>

      <p>
        This page demonstrates how a Credit Union payment behaves during an
        NPP outage when running on TuringCore v3.
      </p>

      <h2>Scenario</h2>
      <ul>
        <li>Payment initiated successfully</li>
        <li>Funds placed on hold</li>
        <li>NPP becomes unavailable</li>
        <li>Outbound payments blocked via kill-switch</li>
      </ul>

      <h2>What Happened</h2>
      <ul>
        <li>Payment remains in <strong>HELD</strong> state</li>
        <li>No debit or credit postings applied</li>
        <li>Funds remain safely reserved</li>
      </ul>

      <h2>Why No Money Moved</h2>
      <p>
        Payments emit intent only. Deposits emit truth.
        Because the NPP adapter was disabled, no deposit postings were applied.
      </p>

      <h2>Evidence</h2>
      <ul>
        <li>Payment Fact Timeline shows no SETTLED fact</li>
        <li>Deposit Fact Timeline shows HOLD only</li>
        <li>Kill-switch activation visible</li>
      </ul>

      <h2>Recovery</h2>
      <p>
        When NPP is restored and the kill-switch re-enabled,
        the payment may be safely retried or reversed without data repair.
      </p>

      <h2>Key Guarantee</h2>
      <p>
        At no point during this failure was a balance mutated incorrectly.
      </p>
    </div>
  )
}
