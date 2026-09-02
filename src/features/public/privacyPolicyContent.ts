export const PRIVACY_POLICY_LAST_UPDATED = 'September 02, 2026';

export type PrivacyPolicySection = {
  id?: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: {
    title: string;
    paragraphs?: string[];
    bullets?: string[];
  }[];
};

/** Edited from TermsFeed free template — aligned with MatchReadyTX data practices. */
export const PRIVACY_POLICY_SECTIONS: PrivacyPolicySection[] = [
  {
    title: 'Introduction',
    paragraphs: [
      'This Privacy Policy describes Our policies and procedures on the collection, use, and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.',
      'We use Your Personal Data to provide and improve the Service. We collect, use, and disclose Your information as described in this Privacy Policy and, where required by applicable law, only where We have a valid legal basis to do so, including Your consent where consent is required.',
      'MatchReadyTX is operated by Justin X. Hale as an open-source scheduling and match-management tool for rugby referee organizations.',
    ],
  },
  {
    title: 'Definitions',
    paragraphs: [
      'For the purposes of this Privacy Policy:',
    ],
    bullets: [
      'Account means a unique account created for You to access Our Service or parts of Our Service.',
      'Company (referred to as "the Company", "We", "Us" or "Our") refers to MatchReadyTX.',
      'Personal Data means any information that relates to an identified or identifiable individual.',
      'Service refers to the Website.',
      'Website refers to MatchReadyTX, accessible from https://matchreadytx.web.app/.',
      'You means the individual accessing or using the Service.',
      'Service Provider means a third party that processes data on Our behalf to facilitate the Service.',
    ],
  },
  {
    title: 'Types of Data Collected',
    subsections: [
      {
        title: 'Personal Data',
        paragraphs: [
          'While using Our Service, We may ask You to provide personally identifiable information, including:',
        ],
        bullets: [
          'Email address, first name, and last name (from Google or Apple sign-in and Your profile)',
          'Phone number and mailing address (required for certain roles such as referees and coaching match officials)',
          'Profile photo, birthday, referee level, jersey and shorts sizes, and refereeing history (where You provide them)',
          'Society roles, team links, availability, match assignments, confirmations, proposals, and reports You submit in the app',
          'Usage Data (see below)',
        ],
      },
      {
        title: 'Sign-in providers',
        paragraphs: [
          'When You sign in with Google or Apple, We receive basic account information from that provider (such as Your email address and name) as permitted by Your account settings and the provider’s policies. We do not receive access to Your Google Drive, Google Sheets, or other cloud files through sign-in.',
        ],
      },
      {
        title: 'Usage Data',
        paragraphs: [
          'Usage Data may include information such as Your device’s Internet Protocol address, browser type, browser version, pages visited, time and date of visits, time spent on pages, and diagnostic data needed to operate and secure the Service.',
        ],
      },
      {
        title: 'Organization schedule data',
        paragraphs: [
          'Your referee society’s match schedule may be synchronized from a Google Sheet using a server-side service account configured by schedulers. That process does not grant MatchReadyTX access to Your personal Google account or files.',
        ],
      },
    ],
  },
  {
    title: 'Cookies and Local Storage',
    paragraphs: [
      'We use cookies and similar technologies that are necessary to authenticate You and keep You signed in, and We use browser local storage or session storage for preferences such as theme and in-app UI state.',
      'We do not use advertising cookies, web beacons, or remarketing pixels. We do not operate a separate cookie-preferences banner; You can clear cookies and site data through Your browser settings, though doing so may sign You out.',
    ],
  },
  {
    title: 'Use of Your Personal Data',
    paragraphs: ['The Company may use Personal Data for the following purposes:'],
    bullets: [
      'To provide and maintain the Service, including match scheduling, assignments, confirmations, and reporting',
      'To manage Your Account and registration',
      'To contact You by email about Service-related notices such as assignments, confirmations, reminders, and account or security updates',
      'To manage Your requests and society workflows (for example, team link requests or fixture proposals)',
      'To enforce role-based visibility within Your organization (for example, limiting when officiating crew details are visible to teams)',
      'To monitor and protect the security and integrity of the Service, including through Google Firebase App Check and reCAPTCHA Enterprise where enabled',
    ],
    subsections: [
      {
        title: 'What We do not do',
        bullets: [
          'We do not sell Your Personal Data',
          'We do not show third-party advertisements in the Service',
          'We do not process payments or sell products through the Service',
          'We do not send marketing newsletters; email is limited to transactional Service notices',
          'We do not currently send SMS text messages (SMS features are not active)',
        ],
      },
    ],
  },
  {
    title: 'Sharing Your Personal Data',
    paragraphs: [
      'We may share Personal Data in the following situations:',
    ],
    bullets: [
      'With Service Providers who assist Us in operating the Service, including Google (Firebase Authentication, Cloud Firestore, Firebase Hosting, Cloud Functions, and Firebase App Check / reCAPTCHA Enterprise), Apple (Sign in with Apple), and Resend (transactional email delivery). Each provider processes data according to its own privacy policy.',
      'With other members of Your referee society organization, according to Your role and Our access rules (for example, member directory information within the society, or match details relevant to Your teams). Officiating crew identifying details are not shown to teams until the assigned Match Official has confirmed.',
      'For business transfers, law enforcement, legal compliance, or protection of rights and safety, as described in standard legal disclosures below.',
      'With Your consent for any other purpose You authorize.',
    ],
  },
  {
    title: 'Retention of Your Personal Data',
    paragraphs: [
      'We retain Personal Data only as long as necessary for the purposes described in this Privacy Policy, including to provide the Service, comply with legal obligations, resolve disputes, and enforce agreements.',
      'Account information is generally retained for the duration of Your Account relationship and for a reasonable period afterward to handle post-closure issues. You may contact Us to ask about retention or deletion.',
    ],
  },
  {
    title: 'Transfer of Your Personal Data',
    paragraphs: [
      'Your information may be processed in locations where Our Service Providers operate. Where required by law, We take steps designed to ensure Your data is handled securely and in accordance with this Privacy Policy.',
    ],
  },
  {
    title: 'Delete Your Personal Data',
    paragraphs: [
      'You may update or correct much of Your information by signing in and using profile settings where available. You may contact Us to request access to, correction of, or deletion of Personal Data We hold about You.',
      'We may retain certain information when We have a legal obligation or other lawful basis to do so.',
    ],
  },
  {
    title: 'Disclosure of Your Personal Data',
    subsections: [
      {
        title: 'Business Transactions',
        paragraphs: [
          'If the Company is involved in a merger, acquisition, or asset sale, Your Personal Data may be transferred. We will provide notice before Your Personal Data becomes subject to a different privacy policy.',
        ],
      },
      {
        title: 'Law Enforcement',
        paragraphs: [
          'Under certain circumstances, the Company may disclose Your Personal Data if required to do so by law or in response to valid requests by public authorities.',
        ],
      },
      {
        title: 'Other Legal Requirements',
        paragraphs: [
          'The Company may disclose Your Personal Data in the good-faith belief that such action is necessary to comply with a legal obligation, protect and defend Our rights or property, prevent or investigate possible wrongdoing, protect personal safety, or protect against legal liability.',
        ],
      },
    ],
  },
  {
    title: 'Security of Your Personal Data',
    paragraphs: [
      'The security of Your Personal Data is important to Us, but no method of transmission over the Internet or electronic storage is completely secure. We strive to use commercially reasonable means to protect Your Personal Data but cannot guarantee absolute security.',
    ],
  },
  {
    title: "Children's Privacy",
    paragraphs: [
      'The Service is not directed to, and We do not knowingly collect Personal Data from, anyone under the age of 16.',
      'If You are a parent or guardian and believe Your child has provided Us with Personal Data, please contact Us. If We become aware that We have collected Personal Data from anyone under 16 without appropriate authorization, We will take steps to delete that information.',
    ],
  },
  {
    title: 'Links to Other Websites',
    paragraphs: [
      'Our Service may contain links to other websites (for example, Google Maps directions or shared schedule documents). If You follow a third-party link, You will leave Our Service. We do not control and are not responsible for the content or privacy practices of third-party sites.',
    ],
  },
  {
    title: 'Changes to this Privacy Policy',
    paragraphs: [
      'We may update this Privacy Policy from time to time. We will post the updated policy on this page and update the "Last updated" date. Material changes may also be communicated by email or a notice within the Service where appropriate.',
    ],
  },
  {
    title: 'Contact Us',
    paragraphs: [
      'If You have questions about this Privacy Policy, contact Us by email at justinxhale@gmail.com.',
    ],
  },
];
