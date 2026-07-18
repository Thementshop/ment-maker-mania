import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';

const Privacy = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="container max-w-3xl px-4 py-10 flex-1">
        <Link to="/" className="text-sm text-primary hover:underline">&larr; Back to home</Link>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-4 mb-2 text-foreground">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: July 2026</p>

        <div className="prose prose-sm md:prose-base max-w-none text-foreground space-y-5 leading-relaxed">
          <p>The Ment Shop ("we," "us," or "our") is operated by Huddy Enterprises, LLC. This Privacy Policy describes how we collect, use, and protect your information when you use The Ment Shop application and related services (collectively, the "Service").</p>
          <p>By using the Service, you agree to the collection and use of information as described in this policy. If you do not agree, please do not use the Service.</p>

          <h2 className="font-display text-xl font-bold mt-8">Information We Collect</h2>
          <p><strong>Account Information:</strong> When you create an account, we collect your email address and a password. We also collect your phone number when you verify your account.</p>
          <p><strong>Compliment Content:</strong> When you send a Ment (compliment), we store the text of the compliment, the sender's identity, and the recipient's contact information (email address or phone number) to deliver the Ment.</p>
          <p><strong>Usage Information:</strong> We collect basic information about how you use the Service, including send activity, timestamps, and device type, to maintain security and improve the Service.</p>
          <p>We do not collect information from children under the age of 13. The Service is intended for users who are 13 years of age or older. If we learn that we have collected personal information from a child under 13, we will promptly delete that information.</p>

          <h2 className="font-display text-xl font-bold mt-8">How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Deliver compliments (Ments) to the recipients you choose</li>
            <li>Verify your phone number during account setup</li>
            <li>Send you notifications when someone sends you a Ment</li>
            <li>Maintain the security of the Service and prevent abuse</li>
            <li>Improve the Service</li>
          </ul>
          <p>We do not sell your personal information. We do not use your information for behavioral advertising or ad targeting. We do not share your information with third parties for their own marketing purposes.</p>

          <h2 className="font-display text-xl font-bold mt-8">SMS and Text Messages</h2>
          <p>When you provide your phone number during account verification, you consent to receive a one-time SMS verification code. Standard message and data rates may apply.</p>
          <p>In the future, we may send SMS notifications when someone sends you a Ment. You may opt out of SMS messages at any time by replying STOP to any message. For help, reply HELP or email donna@mentshop.com.</p>
          <p>Message frequency varies. Verification codes are sent once during account setup. Notification messages are sent when someone sends you a compliment.</p>

          <h2 className="font-display text-xl font-bold mt-8">Email Communications</h2>
          <p>We send emails to notify recipients when someone sends them a Ment. Every notification email includes a one-click unsubscribe link. If you unsubscribe, we will add your email address to our do-not-contact list and will not send you further notification emails.</p>

          <h2 className="font-display text-xl font-bold mt-8">Third-Party Service Providers</h2>
          <p>We use the following service providers to operate the Service. These providers process data on our behalf and are contractually obligated to protect your information:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Supabase (database and authentication hosting)</li>
            <li>Resend (email delivery)</li>
            <li>Twilio (SMS delivery and phone verification)</li>
            <li>Stripe (payment processing for Premium Ment Box purchases)</li>
          </ul>
          <p>These providers may store data on servers located in the United States.</p>

          <h2 className="font-display text-xl font-bold mt-8">Data Retention and Deletion</h2>
          <p>We retain your account information and compliment content for as long as your account is active. You may request deletion of your account and associated data by emailing donna@mentshop.com. We will process deletion requests within 30 days.</p>

          <h2 className="font-display text-xl font-bold mt-8">Security</h2>
          <p>We take reasonable measures to protect your information, including server-side content validation, encrypted connections (HTTPS), and access controls. However, no method of transmission or storage is 100% secure, and we cannot guarantee absolute security.</p>

          <h2 className="font-display text-xl font-bold mt-8">Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your information</li>
            <li>Object to certain uses of your information</li>
          </ul>
          <p>To exercise any of these rights, email donna@mentshop.com.</p>

          <h2 className="font-display text-xl font-bold mt-8">Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the updated policy on this page with a revised "Last updated" date.</p>

          <h2 className="font-display text-xl font-bold mt-8">Contact Us</h2>
          <p>If you have questions about this Privacy Policy, contact us at:</p>
          <p>
            Huddy Enterprises, LLC DBA The Ment Shop<br />
            Email: <a href="mailto:donna@mentshop.com" className="text-primary hover:underline">donna@mentshop.com</a>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Privacy;
