import WithdrawPanel from '../../components/WithdrawPanel';
import { useMerchantAnalytics } from '../../lib/queries';
import { rupees } from '../../lib/format';

export default function MerchantPayouts() {
  const analytics = useMerchantAnalytics();
  const window = analytics.data?.window;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-forest-800">Payouts</h1>
        <p className="text-sm text-ink-500">
          Your earnings on delivered orders, settled to JazzCash, Easypaisa or a bank account.
        </p>
      </div>

      <WithdrawPanel audience="merchant" />

      <section className="card p-4">
        <h2 className="text-sm font-bold text-forest-800">How the money works</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-500">
          <li>· Customers pay you directly; Qareeb keeps the platform commission on delivered orders.</li>
          <li>· Only <span className="font-semibold text-ink-700">delivered</span> orders count towards your balance — cancelled orders are refunded.</li>
          <li>
            · In the last 14 days you delivered {window?.orders ?? 0} orders worth {rupees(window?.revenue ?? 0)}; commission was{' '}
            {rupees(window?.commission ?? 0)}.
          </li>
          <li>· Withdrawals are reviewed by the Qareeb team, usually the same working day.</li>
        </ul>
      </section>
    </div>
  );
}
