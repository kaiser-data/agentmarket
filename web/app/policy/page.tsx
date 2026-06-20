import { getServices } from "@/lib/data";
import { PolicyEngine } from "@/components/PolicyEngine";

export default function PolicyPage() {
  const services = getServices();
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="label">Wallet policy engine · what your agent would pay</p>
      <h1 className="font-display mt-3 text-3xl sm:text-4xl">Trust policy simulator</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
        This is the difference between analytics and infrastructure. Set the rules your
        agent&apos;s wallet should enforce, and Themis decides — per service — whether to
        pay or refuse, and says why. Nothing here moves money; it shows the verdict the
        policy would produce before a single cent is spent.
      </p>
      <PolicyEngine services={services} />
    </div>
  );
}
