import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';

const SmsTerms = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="container max-w-3xl px-4 py-10 flex-1">
        <Link to="/" className="text-sm text-primary hover:underline">&larr; Back to home</Link>
        <h1 className="font-display text-3xl md:text-4xl font-bold mt-4 mb-2 text-foreground">SMS Terms &amp; Opt-In</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: July 2026</p>

        <div className="prose prose-sm md:prose-base max-w-none text-foreground space-y-5 leading-relaxed">
          <h2 className="font-display text-xl font-bold mt-4">Program Description</h2>
          <p>The Ment Shop, operated by Huddy Enterprises, LLC DBA The Ment Shop, uses SMS to (1) verify a user's phone number during account setup and (2) deliver compliments ("Ments") that a sender chooses to send by text message to a recipient.</p>

          <h2 className="font-display text-xl font-bold mt-8">How Users Opt In</h2>
          <p>Users opt in to receive SMS from The Ment Shop by taking one of the following actions:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account holders:</strong> After creating an account at mentshop.com, the user enters their mobile phone number in the Phone Verification screen, checks a consent checkbox stating "I agree to receive SMS messages from The Ment Shop for account verification and Ment delivery. Message and data rates may apply. Reply STOP to opt out," and taps "Send Code." A one-time 6-digit verification code is then sent to the number provided.</li>
            <li><strong>Recipients:</strong> A recipient receives a single SMS notification only when another user (the sender) chooses to send them a Ment by text and enters their phone number. The notification includes the sender's name, a short kind message, and a link to unwrap the Ment. Every recipient message includes opt-out instructions.</li>
          </ul>

          <h2 className="font-display text-xl font-bold mt-8">Sample Messages</h2>
          <p><strong>Verification code:</strong></p>
          <p className="bg-muted p-3 rounded text-sm">The Ment Shop: Your verification code is 123456. Reply STOP to opt out.</p>
          <p><strong>Ment delivery notification:</strong></p>
          <p className="bg-muted p-3 rounded text-sm">The Ment Shop: You've got a Ment from Donna! Tap to unwrap: https://mentshop.com/ment/abc123 Reply STOP to opt out.</p>

          <h2 className="font-display text-xl font-bold mt-8">Message Frequency</h2>
          <p>Message frequency varies based on user activity. Verification messages are sent once per phone number during account setup. Ment delivery messages are sent only when a sender specifically chooses to deliver a compliment to that recipient by text.</p>

          <h2 className="font-display text-xl font-bold mt-8">Message and Data Rates</h2>
          <p>Message and data rates may apply. Please check with your mobile carrier for details. The Ment Shop does not charge users for SMS messages.</p>

          <h2 className="font-display text-xl font-bold mt-8">Opt-Out Instructions</h2>
          <p>You can opt out of SMS messages from The Ment Shop at any time by replying <strong>STOP</strong> to any message you receive from us. After you send STOP, we will send one final confirmation message and will not send you any additional SMS messages unless you opt back in.</p>
          <p>To opt back in, reply <strong>START</strong> or contact us at hello@mentshop.com.</p>

          <h2 className="font-display text-xl font-bold mt-8">Help</h2>
          <p>For help, reply <strong>HELP</strong> to any message from us, or email <a href="mailto:hello@mentshop.com" className="text-primary hover:underline">hello@mentshop.com</a>.</p>

          <h2 className="font-display text-xl font-bold mt-8">Carriers</h2>
          <p>Carriers are not liable for delayed or undelivered messages. Supported carriers include AT&amp;T, Verizon, T-Mobile, Sprint, and most other US carriers.</p>

          <h2 className="font-display text-xl font-bold mt-8">Privacy</h2>
          <p>Phone numbers collected for SMS are used only to deliver verification codes and Ment notifications. We do not sell or share phone numbers with third parties for marketing purposes. See our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> for full details.</p>

          <h2 className="font-display text-xl font-bold mt-8">Contact</h2>
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

export default SmsTerms;
