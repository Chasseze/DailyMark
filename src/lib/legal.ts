/**
 * Single source of truth for the identity and contact details the Privacy
 * Notice and Terms of Use quote. Both pages read these, so a change here
 * updates the pair and they can never disagree with each other.
 */
export const OPERATOR_NAME = "CharlesEZE Group";

export const CONTACT_EMAIL = "hello@chasseze.com";

/**
 * Governing law for the Terms.
 *
 * A contract can only name one, so this is one. Nigeria was chosen because
 * governing law should track where the operator actually is — that is where a
 * dispute would realistically be brought and enforced, and naming a foreign
 * law a local court would have to apply is the expensive option for a small
 * operator. Users elsewhere keep their own mandatory consumer and
 * data-protection rights regardless; the Terms say so explicitly.
 *
 * If CharlesEZE Group is registered in a US state rather than Nigeria, change
 * this to that state (e.g. "the State of Delaware, United States") — it is the
 * only edit needed.
 */
export const GOVERNING_LAW = "the Federal Republic of Nigeria";
