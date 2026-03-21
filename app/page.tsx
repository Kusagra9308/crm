import { auth } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <>
      <main className="min-h-screen bg-white text-slate-900">
        {/* Hero Section */}
        <section className="px-6 py-20 text-center max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Intelligent CRM for{" "}
            <span className="text-blue-600">Smart Businesses</span>
          </h1>

          <p className="mt-6 text-lg text-slate-600">
            Go beyond traditional CRMs. Get real-time insights, predictive analytics,
            and AI-powered decision support — built for SMEs.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            {isLoggedIn ? (
              <Link href="/dashboard" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
                Open Dashboard
              </Link>
            ) : (
              <Link href="/signup" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
                Get Started
              </Link>
            )}
            <button className="border border-slate-300 px-6 py-3 rounded-lg hover:bg-slate-50 transition text-slate-700 shadow-sm">
              Learn More
            </button>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-16 max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <FeatureCard
            title="Real-Time Insights"
            desc="Track sales, leads, and performance instantly with live dashboards."
          />
          <FeatureCard
            title="AI Predictions"
            desc="Predict deal success, prioritize leads, and detect churn risks."
          />
          <FeatureCard
            title="Multi-Tenant Secure"
            desc="Enterprise-grade isolation and security for multiple organizations."
          />
        </section>

        {/* Architecture Overview */}
        <section className="px-6 py-20 bg-slate-50 text-center border-y border-slate-200">
          <h2 className="text-3xl font-semibold mb-6">Built for Scale & Intelligence</h2>

          <p className="text-slate-600 max-w-3xl mx-auto">
            Our platform integrates with external CRMs like HubSpot, processes data
            using a real-time ETL pipeline, and delivers actionable insights through
            AI-powered analytics — all within a secure, cloud-ready architecture.
          </p>
        </section>

        {/* CTA */}
        <section className="px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold">
            Ready to Upgrade Your CRM?
          </h2>

          <p className="mt-4 text-slate-600">
            Bring enterprise intelligence to your business without enterprise cost.
          </p>

          {isLoggedIn ? (
            <Link href="/dashboard" className="mt-6 inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition">
              Open Dashboard
            </Link>
          ) : (
            <Link href="/signup" className="mt-6 inline-block bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition">
              Start Free Trial
            </Link>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md transition">
      <h3 className="text-xl font-semibold mb-3 text-slate-900">{title}</h3>
      <p className="text-slate-600">{desc}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-50 border-t border-slate-200">
      <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-8 text-slate-600">
        
        {/* Brand */}
        <div>
          <h3 className="text-slate-900 text-xl font-semibold mb-3">
            SmartCRM
          </h3>
          <p>
            Intelligent CRM platform delivering real-time insights and
            AI-powered decision support for modern businesses.
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-slate-900 font-medium mb-3">Product</h4>
          <ul className="space-y-2">
            <li className="hover:text-blue-600 cursor-pointer transition">Features</li>
            <li className="hover:text-blue-600 cursor-pointer transition">Pricing</li>
            <li className="hover:text-blue-600 cursor-pointer transition">Integrations</li>
          </ul>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-slate-900 font-medium mb-3">Company</h4>
          <ul className="space-y-2">
            <li className="hover:text-blue-600 cursor-pointer transition">About</li>
            <li className="hover:text-blue-600 cursor-pointer transition">Contact</li>
            <li className="hover:text-blue-600 cursor-pointer transition">Privacy Policy</li>
          </ul>
        </div>
      </div>

      {/* Bottom */}
      <div className="border-t border-slate-200 text-center py-6 text-slate-500 text-sm">
        © {new Date().getFullYear()} SmartCRM. All rights reserved.
      </div>
    </footer>
  );
}
