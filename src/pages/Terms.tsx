import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';

const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="container max-w-3xl px-4 py-10 flex-1">
        <Link to="/" className="text-sm text-primary hover:underline">&larr; Back to home</Link>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-4 mb-2 text-foreground">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: July 2026</p>

        <div className="prose prose-sm md:prose-base max-w-none text-foreground space-y-5 leading-relaxed">
          <p>Welcome to The Ment Shop. These Terms of Service ("Terms") govern your use of The Ment Shop application and related services (the "Service"), operated by Huddy Enterprises, LLC DBA The Ment Shop ("we," "us," or "our").</p>
          <p>By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.</p>

          <h2 className="font-display text-xl font-bold mt-8">Eligibility</h2>
          <p>You must be at least 13 years old to use the Service. By creating an account, you confirm that you are at least 13 years of age. If we learn that a user is under 13, we will terminate their account and delete their information.</p>

          <h2 className="font-display text-xl font-bold mt-8">What The Ment Shop Is</h2>
          <p>The Ment Shop is a platform for sending compliments ("Ments") to other people. You choose a recipient, select or write a compliment, and send it. The recipient receives a notification, taps to unwrap the compliment in a cinematic reveal, and discovers who sent it.</p>
          <p>The Ment Shop is a kindness platform. It is designed to carry only positive, kind messages.</p>

          <h2 className="font-display text-xl font-bold mt-8">Your Account</h2>
          <p>You are responsible for maintaining the security of your account and password. You are responsible for all activity that occurs under your account. You agree to provide accurate information when creating your account, including a valid email address and phone number.</p>
          <p>Phone number verification is required before you can send your first Ment. By providing your phone number, you consent to receive a one-time SMS verification code. Standard message and data rates may apply.</p>

          <h2 className="font-display text-xl font-bold mt-8">Acceptable Use</h2>
          <p>You agree to use the Service only for its intended purpose: sending genuine compliments and kind messages to other people. You agree NOT to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Send harassing, threatening, abusive, or hateful content</li>
            <li>Use the Service to spam, advertise, or send unsolicited bulk messages</li>
            <li>Impersonate another person</li>
            <li>Attempt to bypass content filters or security measures</li>
            <li>Create multiple accounts to evade restrictions or bans</li>
            <li>Use automated tools, bots, or scripts to interact with the Service</li>
          </ul>
          <p>We enforce a positivity-only content policy. All custom compliments are screened by our content moderation system. Messages that do not meet our standards will be rejected. Repeated violations may result in account suspension or termination.</p>

          <h2 className="font-display text-xl font-bold mt-8">SMS and Text Messages</h2>
          <p>By providing your phone number, you consent to receive SMS messages from The Ment Shop for account verification and service notifications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out of SMS messages at any time. Reply HELP for assistance. You can also contact hello@mentshop.com for support.</p>
          <p>Carriers are not liable for delayed or undelivered messages. Consent to receive SMS is not a condition of purchase.</p>

          <h2 className="font-display text-xl font-bold mt-8">Recipient Communications</h2>
          <p>When you send a Ment, we send a notification to your chosen recipient via email or SMS. Recipients who do not have an account with The Ment Shop may receive these notifications. Every notification includes an option to unsubscribe from future messages.</p>

          <h2 className="font-display text-xl font-bold mt-8">Content and Intellectual Property</h2>
          <p>Compliments you write and send through the Service remain your words, but you grant us a non-exclusive, royalty-free license to display them to the recipient as part of the Ment delivery experience.</p>
          <p>The Ment Shop name, logo, brand elements, and application design are the property of Huddy Enterprises, LLC. You may not use our branding without written permission.</p>

          <h2 className="font-display text-xl font-bold mt-8">Premium Ment Boxes</h2>
          <p>Premium Ment Boxes are optional paid products that add a branded gift box experience to your Ment delivery. Purchases are processed through Stripe. All sales are final. Premium Ment Boxes are a digital product and are non-refundable once purchased.</p>

          <h2 className="font-display text-xl font-bold mt-8">Reporting and Blocking</h2>
          <p>If you receive a Ment that you believe is inappropriate, you can report it directly from the Ment reveal screen. You can also block a sender to prevent them from sending you future Ments. We review all reports and take action as appropriate, including content removal and account suspension.</p>

          <h2 className="font-display text-xl font-bold mt-8">Account Termination</h2>
          <p>We reserve the right to suspend or terminate your account at any time if you violate these Terms or engage in behavior that is harmful to other users or the Service. You may request deletion of your account at any time by emailing hello@mentshop.com.</p>

          <h2 className="font-display text-xl font-bold mt-8">Disclaimers</h2>
          <p>The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or secure.</p>

          <h2 className="font-display text-xl font-bold mt-8">Limitation of Liability</h2>
          <p>To the fullest extent permitted by law, Huddy Enterprises, LLC shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.</p>

          <h2 className="font-display text-xl font-bold mt-8">Changes to These Terms</h2>
          <p>We may update these Terms from time to time. We will notify you of significant changes by posting the updated Terms on this page. Your continued use of the Service after changes are posted constitutes acceptance of the updated Terms.</p>

          <h2 className="font-display text-xl font-bold mt-8">Governing Law</h2>
          <p>These Terms are governed by the laws of the State of Florida, without regard to conflict of law principles.</p>

          <h2 className="font-display text-xl font-bold mt-8">Contact Us</h2>
          <p>If you have questions about these Terms, contact us at:</p>
          <p>
            Huddy Enterprises, LLC DBA The Ment Shop<br />
            Email: <a href="mailto:hello@mentshop.com" className="text-primary hover:underline">hello@mentshop.com</a>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Terms;
