import LegalLayout, { Todo } from "../components/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout title="Terms of Use" updated="11 September 2026">
      <p className="legal__lede">
        These terms cover your use of DailyMark, a personal notes app run by an
        individual developer, <Todo>[OPERATOR NAME]</Todo>. Using the app means
        you accept them.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>You need an account, and you are responsible for keeping your password to yourself.</li>
        <li>One person per account. Do not share your credentials.</li>
        <li>You must be 13 or older.</li>
        <li>Tell the operator promptly if you think someone else has access to your account.</li>
      </ul>

      <h2>Your content stays yours</h2>
      <p>
        You keep every right you have in what you write. Nothing here transfers
        ownership. The only permission you give is the narrow, practical one
        needed to run the service: to store your content, back it up, and show
        it back to you — and, if you create a share link, to show that content
        to people who open the link. That permission ends when you delete the
        content or your account.
      </p>

      <h2>What you agree not to do</h2>
      <ul>
        <li>Use DailyMark to store or share anything unlawful, or anything you have no right to hold.</li>
        <li>Attempt to reach other people's accounts or data.</li>
        <li>Attack, overload, or probe the service or the infrastructure behind it.</li>
        <li>Use automated means to bulk-extract data beyond the app's own export features.</li>
      </ul>

      <h2>Back up your own work</h2>
      <p>
        This is the clause to actually read. DailyMark is run by one person on
        third-party infrastructure. Data loss, extended downtime, or the service
        ending are all genuinely possible. The app gives you a full export in
        Settings — <strong>use it periodically</strong>. Do not let DailyMark be
        the only copy of anything you cannot afford to lose.
      </p>

      <h2>Service availability</h2>
      <p>
        The app is provided as it is, without any guarantee of uptime,
        preservation, or fitness for a particular purpose. Features may change
        or be removed. The service may be suspended or discontinued; where
        that is planned rather than forced, reasonable notice will be given so
        you can export your data.
      </p>

      <h2>Limits on liability</h2>
      <p>
        To the fullest extent the law allows, the operator is not liable for
        indirect or consequential loss, or for lost data, lost profits, or lost
        opportunity arising from your use of DailyMark. Nothing here excludes
        liability that cannot lawfully be excluded — including for death or
        personal injury caused by negligence, or for fraud.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop and delete your account at any time. The operator may
        suspend or end an account that breaches these terms, or where required
        by law. Export your data before you delete an account: deletion is
        final.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of{" "}
        <Todo>[GOVERNING JURISDICTION — one country or state must be named here]</Todo>.
        Whichever is chosen, this does not take away the protections you have
        under the mandatory consumer and data-protection laws of the country you
        actually live in — including, where they apply to you, the laws of
        Nigeria or of your state in the United States.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If these terms change materially, the date at the top changes and the
        change will be noted in the app. Continuing to use DailyMark after that
        means you accept the revised terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <Todo>[CONTACT EMAIL]</Todo>.
      </p>
    </LegalLayout>
  );
}
