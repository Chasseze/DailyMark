import LegalLayout, { Todo } from "../components/LegalLayout";

export default function Privacy() {
  return (
    <LegalLayout title="Privacy Notice" updated="11 September 2026">
      <p className="legal__lede">
        DailyMark is a personal notes app run by an individual developer,{" "}
        <Todo>[OPERATOR NAME]</Todo>. This notice describes exactly what the app
        stores, where it stores it, and how to get it back or delete it. It
        describes the app as actually built — not as an aspiration.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>Your notes are yours. They are not read, mined, sold, or used to train anything.</li>
        <li>There is no advertising, no analytics, and no third-party tracking in this app. None.</li>
        <li>An account is required, so an email address is stored.</li>
        <li>Anything you share with a link becomes readable by anyone holding that link.</li>
      </ul>

      <h2>What is stored in your account</h2>
      <ul>
        <li><strong>Account</strong> — your email address and a securely hashed password, held by the authentication service. If you sign in with Google, the email address on that Google account.</li>
        <li><strong>Your writing</strong> — note titles, note bodies, tags, notebooks, and the timestamps on them.</li>
        <li><strong>Note history</strong> — earlier versions of a note, so an accidental overwrite can be recovered.</li>
        <li><strong>Images</strong> — pictures you add to a note, in private per-user storage that is not publicly readable.</li>
        <li><strong>Everyday use</strong> — daily mood entries, quiz and recall progress, evening Return sessions, bookmarks, and library collections.</li>
        <li><strong>Share links</strong> — a random token for each note or notebook you choose to share.</li>
        <li><strong>Reminders</strong> — if you turn on push notifications, the browser subscription needed to deliver them.</li>
      </ul>

      <h2>What is stored on your device</h2>
      <p>
        So the app works offline and does not lose writing: an offline copy of
        your notes, your sign-in session, and optional recovery copies of
        unsaved edits. This never leaves your device on its own. You can erase
        all of it from <strong>Settings → This device</strong>, or by signing
        out.
      </p>

      <h2>Microphone, camera, and speech</h2>
      <ul>
        <li>
          <strong>Dictation</strong> uses your browser's built-in speech
          recognition. Be aware that in some browsers — Chrome in particular —
          this means the browser sends your audio to its own vendor's servers to
          transcribe it. That transcription is the browser's, not DailyMark's,
          and is outside this app's control. If that matters to you, type
          instead of dictating.
        </li>
        <li>
          <strong>Note scan</strong> uses your camera only while the scanner is
          open. Nothing is kept unless you save the captured image into a note.
        </li>
        <li>
          <strong>Read aloud</strong> uses the voices already on your device and
          sends nothing anywhere.
        </li>
      </ul>

      <h2>Who else is involved</h2>
      <ul>
        <li>
          <strong>Supabase</strong> hosts the database, authentication, and file
          storage. Your notes physically live there.
        </li>
        <li>
          <strong>Vercel</strong> serves the app itself and processes the
          ordinary connection data any web host sees, such as IP addresses.
        </li>
      </ul>
      <p>
        These are infrastructure providers acting on the operator's
        instructions. No one else receives your data, and it is never sold.
      </p>

      <h2>Sharing is a decision you make</h2>
      <p>
        A share link makes that note or notebook readable by anyone who has the
        link, without signing in. Links do not expire on their own. Only share
        what you mean to make public, and treat a shared link as public.
      </p>

      <h2>Your rights</h2>
      <p>
        Wherever you live, you can ask for a copy of your data, correction of
        it, or its deletion. Much of this you can do yourself:
      </p>
      <ul>
        <li><strong>Export</strong> — Settings has a full backup export, and you can export a selection of notes.</li>
        <li><strong>Delete</strong> — Trash, then Empty trash, removes notes permanently.</li>
        <li><strong>Erase this device</strong> — Settings → This device.</li>
        <li><strong>Delete the whole account</strong> — email <Todo>[CONTACT EMAIL]</Todo> and it will be removed.</li>
      </ul>
      <p>
        Depending on where you live these may be legal rights rather than
        courtesies — for example under Nigeria's Data Protection Act, under
        state privacy laws in the United States, or under the GDPR and UK GDPR.
        This notice applies the same standard to everyone regardless of which
        applies to you.
      </p>

      <h2>How long things are kept</h2>
      <p>
        Notes stay until you delete them. Trashed notes stay until you empty the
        Trash. Note history is kept alongside the note. If you delete your
        account, the account and its contents are removed.
      </p>

      <h2>Children</h2>
      <p>
        DailyMark is not intended for children under 13, and accounts should not
        be created for them.
      </p>

      <h2>Changes</h2>
      <p>
        If this notice changes in a way that materially affects you, the date at
        the top changes and the change will be noted in the app.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, requests, or complaints: <Todo>[CONTACT EMAIL]</Todo>.
      </p>
    </LegalLayout>
  );
}
