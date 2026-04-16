export const metadata = {
  title: "Privacy Policy",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-display font-bold uppercase tracking-wide mb-2">
          Privacy <span className="text-brand-orange">Policy</span>
        </h1>
        <p className="text-text-muted text-sm mb-8">
          Last updated: April 16, 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-6 text-text-secondary text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              1. Introduction
            </h2>
            <p>
              863 Athletics LLC (&quot;863 Athletics,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the website
              863athletics.com and related services. This Privacy Policy explains what data we collect,
              how we use it, and your rights regarding your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              2. Information We Collect
            </h2>
            <p>We collect the following information when you create an account and use our services:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-text-primary">Account Information:</strong> First name, last name, email address, phone number, and password.</li>
              <li><strong className="text-text-primary">Booking Information:</strong> Session dates, times, booking types, booking history, and special requests.</li>
              <li><strong className="text-text-primary">Payment Information:</strong> Payment method type and transaction records. Credit card details are processed securely by Stripe and are never stored on our servers.</li>
              <li><strong className="text-text-primary">Emergency Contact:</strong> Emergency contact name and phone number (optional).</li>
              <li><strong className="text-text-primary">Waiver Information:</strong> Digital signature, date signed, and IP address for liability waiver records.</li>
              <li><strong className="text-text-primary">Communication Preferences:</strong> Your choices regarding email notifications, SMS notifications, and session reminders.</li>
              <li><strong className="text-text-primary">Usage Data:</strong> Pages visited, features used, and general usage patterns to improve our service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              3. How We Use Your Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Create and manage your account.</li>
              <li>Process bookings and payments.</li>
              <li>Generate and deliver facility access codes via SMS and email.</li>
              <li>Send booking confirmations, modifications, and cancellation notices.</li>
              <li>Send session reminders (24 hours and 1 hour before your booking).</li>
              <li>Provide customer support and respond to inquiries.</li>
              <li>Improve our services, website, and user experience.</li>
              <li>Comply with legal obligations and enforce our terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              4. Information Sharing
            </h2>
            <p>
              <strong className="text-text-primary">We do not sell, rent, or share your personal information with third parties for marketing purposes.</strong>
            </p>
            <p className="mt-2">We share information only with the following service providers who assist us in operating our platform:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong className="text-text-primary">Stripe:</strong> Payment processing. Stripe&apos;s privacy policy applies to payment data.</li>
              <li><strong className="text-text-primary">Twilio:</strong> SMS delivery for access codes and booking notifications.</li>
              <li><strong className="text-text-primary">Resend:</strong> Email delivery for booking confirmations and reminders.</li>
              <li><strong className="text-text-primary">Supabase:</strong> Secure database hosting and authentication.</li>
              <li><strong className="text-text-primary">Vercel:</strong> Website hosting.</li>
            </ul>
            <p className="mt-2">
              These providers only access data necessary to perform their specific services and are contractually
              obligated to protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              5. SMS/Text Messaging
            </h2>
            <p>
              By providing your phone number and opting in to SMS notifications, you consent to receive
              text messages from 863 Athletics related to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Booking confirmations and updates</li>
              <li>Facility access codes</li>
              <li>Session reminders</li>
              <li>Booking cancellation notices</li>
            </ul>
            <p className="mt-2">
              Message frequency varies based on your booking activity. Message and data rates may apply.
              Your phone number will not be shared with third parties for marketing purposes.
            </p>
            <p className="mt-2">
              You can opt out of SMS at any time by replying <strong className="text-text-primary">STOP</strong> to
              any message or by disabling SMS notifications in your account profile settings. Reply{" "}
              <strong className="text-text-primary">HELP</strong> for assistance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              6. Data Security
            </h2>
            <p>
              We implement industry-standard security measures to protect your personal information,
              including encryption in transit (TLS/SSL), secure password hashing, row-level security
              policies on our database, and regular security reviews. However, no method of electronic
              transmission or storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              7. Data Retention
            </h2>
            <p>
              We retain your account and booking data for as long as your account is active. If you
              request account deletion, we will remove your personal data within 30 days, except where
              retention is required by law (e.g., payment records for tax purposes).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              8. Your Rights
            </h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and data.</li>
              <li>Opt out of SMS and email communications.</li>
              <li>Withdraw consent for data processing at any time.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:863athletics@gmail.com" className="text-brand-orange hover:underline">
                863athletics@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              9. Children&apos;s Privacy
            </h2>
            <p>
              Our services are not directed to individuals under 18 years of age. We do not knowingly
              collect personal information from children under 18.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes
              by posting the updated policy on this page with a revised &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              11. Contact Us
            </h2>
            <p>
              If you have questions about this Privacy Policy, contact us at:
            </p>
            <div className="mt-2 bg-bg-secondary rounded-lg border border-border p-4">
              <p className="text-text-primary font-semibold">863 Athletics LLC</p>
              <p>Lakeland, FL</p>
              <p>Email: <a href="mailto:863athletics@gmail.com" className="text-brand-orange hover:underline">863athletics@gmail.com</a></p>
              <p>Phone: (863) 555-0863</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
