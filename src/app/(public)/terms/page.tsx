export const metadata = {
  title: "Terms & Conditions",
}

export default function TermsPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-display font-bold uppercase tracking-wide mb-2">
          Terms & <span className="text-brand-orange">Conditions</span>
        </h1>
        <p className="text-text-muted text-sm mb-8">
          Last updated: April 16, 2026
        </p>

        <div className="prose prose-invert max-w-none space-y-6 text-text-secondary text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              1. Program Overview
            </h2>
            <p>
              <strong className="text-text-primary">863 Athletics</strong> is a gym booking platform operated
              by 863 Athletics LLC in Haines City, Florida. Our platform allows customers to book training
              sessions, receive facility access codes, and manage their bookings online at 863athletics.com.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              2. Account Registration
            </h2>
            <p>
              By creating an account, you agree to provide accurate, current, and complete information.
              You are responsible for maintaining the confidentiality of your account credentials and for
              all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              3. Bookings and Payments
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>All bookings are subject to availability.</li>
              <li>Prices are displayed in US Dollars and are subject to change.</li>
              <li>We accept credit/debit cards, Apple Pay, Google Pay, Zelle, and Cash App.</li>
              <li>Payment is required at the time of booking for card payments. Manual payments (Zelle/Cash App) must be confirmed by an administrator within 2 hours.</li>
              <li>You will receive a booking confirmation via email and/or SMS upon successful payment.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              4. Cancellation and Refund Policy
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Cancellations made 24 or more hours before the scheduled session are eligible for a full refund.</li>
              <li>Cancellations made less than 24 hours before the session may not be eligible for a refund.</li>
              <li>Refunds for card payments are processed within 3-5 business days.</li>
              <li>No-shows are not eligible for refunds.</li>
              <li>863 Athletics reserves the right to cancel or modify bookings due to unforeseen circumstances, in which case a full refund will be issued.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              5. Access Codes
            </h2>
            <p>
              Upon confirmed booking, you will receive a time-bound access code for the facility. These codes are:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li>For your personal use only during your booked session.</li>
              <li>Not to be shared with any other individual.</li>
              <li>Valid only for the duration of your booking (plus a 30-minute buffer).</li>
              <li>Your responsibility to use properly and secure the facility upon departure.</li>
            </ul>
            <p className="mt-2">
              Misuse of access codes may result in account suspension or termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              6. SMS/Text Message Terms
            </h2>
            <div className="bg-bg-secondary rounded-lg border border-border p-4 space-y-3">
              <p>
                <strong className="text-text-primary">Program Name:</strong> 863 Athletics Booking Notifications
              </p>
              <p>
                <strong className="text-text-primary">Description:</strong> When you opt in to SMS notifications,
                863 Athletics will send you text messages related to your bookings, including confirmations,
                access codes, session reminders, and cancellation notices.
              </p>
              <p>
                <strong className="text-text-primary">Message Frequency:</strong> Message frequency varies based
                on your booking activity. Typically 2-5 messages per booking (confirmation, access code,
                reminders).
              </p>
              <p>
                <strong className="text-text-primary">Message and Data Rates:</strong> Message and data rates may
                apply depending on your mobile carrier and plan. 863 Athletics is not responsible for any
                charges from your carrier.
              </p>
              <p>
                <strong className="text-text-primary">Opt-Out:</strong> You can stop receiving text messages at
                any time by replying <strong className="text-white">&quot;STOP&quot;</strong> to any message from 863 Athletics.
                You will receive a confirmation message and no further SMS will be sent. You can also
                disable SMS notifications in your account profile settings at 863athletics.com/profile.
              </p>
              <p>
                <strong className="text-text-primary">Help:</strong> For help or questions about our SMS program,
                reply <strong className="text-white">&quot;HELP&quot;</strong> to any message, email us at{" "}
                <a href="mailto:863athletics@gmail.com" className="text-brand-orange hover:underline">
                  863athletics@gmail.com
                </a>, or call (863) 521-9540.
              </p>
              <p>
                <strong className="text-text-primary">Supported Carriers:</strong> Compatible with all major US
                carriers including AT&T, Verizon, T-Mobile, Sprint, and others.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              7. Facility Rules
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>All users must sign a liability waiver before their first session.</li>
              <li>Proper athletic attire and closed-toe shoes are required.</li>
              <li>Equipment must be used properly and returned to its designated location.</li>
              <li>Users are responsible for cleaning equipment after use.</li>
              <li>No unauthorized guests or sharing of access codes.</li>
              <li>863 Athletics reserves the right to deny access to anyone who violates facility rules.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              8. Liability
            </h2>
            <p>
              Use of 863 Athletics facilities is at your own risk. By using our services, you acknowledge
              that physical exercise involves inherent risks of injury. All users must sign the liability
              waiver available at{" "}
              <a href="/waiver" className="text-brand-orange hover:underline">
                863athletics.com/waiver
              </a>{" "}
              before their first session.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              9. Intellectual Property
            </h2>
            <p>
              All content on 863athletics.com, including text, graphics, logos, and software, is the
              property of 863 Athletics LLC and is protected by applicable intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              10. Modifications
            </h2>
            <p>
              863 Athletics reserves the right to modify these terms at any time. Changes will be posted
              on this page with an updated &quot;Last updated&quot; date. Continued use of our services after
              changes constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              11. Governing Law
            </h2>
            <p>
              These Terms and Conditions are governed by the laws of the State of Florida. Any disputes
              arising from these terms shall be resolved in the courts of Polk County, Florida.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-display font-bold uppercase tracking-wide text-text-primary mb-3">
              12. Contact Information
            </h2>
            <div className="bg-bg-secondary rounded-lg border border-border p-4">
              <p className="text-text-primary font-semibold">863 Athletics LLC</p>
              <p>2195 S 30th St, Haines City, FL 33844</p>
              <p>Email: <a href="mailto:863athletics@gmail.com" className="text-brand-orange hover:underline">863athletics@gmail.com</a></p>
              <p>Phone: (863) 521-9540</p>
              <p>Website: <a href="https://863athletics.com" className="text-brand-orange hover:underline">863athletics.com</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
