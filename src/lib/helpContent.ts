/** Ready answers for the Help button. Plain text only. Keep each answer short and true to how the app works today. */
export type HelpTopic = 'start' | 'bidding' | 'payments' | 'visits' | 'projects' | 'trust' | 'team' | 'community' | 'design';
export type PageKey = 'home' | 'projects' | 'marketplace' | 'community' | 'find' | 'settings' | 'business' | 'invite' | 'app' | 'design';
export type HelpItem = { q: string; a: string; topic: HelpTopic; who: 'h' | 'c' | 'both'; pages?: PageKey[] };

export const TOPICS: [HelpTopic, string][] = [
  ['start', 'Getting started'],
  ['bidding', 'Bidding'],
  ['payments', 'Payments'],
  ['visits', 'Visits'],
  ['projects', 'Projects'],
  ['trust', 'Trust and privacy'],
  ['team', 'Teaming up'],
  ['community', 'Community'],
  ['design', 'Design ideas'],
];

export const HELP: HelpItem[] = [
  { topic: 'start', who: 'both', q: 'What is Jobfile?', a: 'A place where homeowners post projects and compare bids from local contractors, then keep the price, photos, schedule and payments for the job in one shared record.' },
  { topic: 'start', who: 'both', q: 'Does it cost anything?', a: 'Jobfile is free to start. There is no subscription, and nothing is taken from jobs you win.' },
  { topic: 'start', who: 'both', q: 'How do I get the Jobfile app on my phone?', pages: ['app'], a: 'Open Jobfile in Safari (iPhone) or Chrome (Android), tap Share or the menu, then Add to Home Screen. The Get the app page in the menu shows each step. No App Store is needed.' },
  { topic: 'start', who: 'both', q: 'How do I get alerts on my phone?', pages: ['settings'], a: 'Turn on phone alerts from the card on Projects or in Settings. On iPhone, add Jobfile to your Home Screen first. You choose which kinds of alerts you get.' },
  { topic: 'start', who: 'both', q: 'Already have a contractor or a customer?', pages: ['home'], a: 'You do not need the marketplace. Start a project, send an invite by email, and they join with one tap. The person you invite does not need an account first.' },
  { topic: 'start', who: 'h', q: 'How do I get bids?', a: 'Tap Post a project, choose the work, add photos and a budget, and publish. Contractors near you can then send bids, and you compare them side by side.' },
  { topic: 'start', who: 'c', q: 'How do I find work?', pages: ['marketplace'], a: 'Open Find work to see open projects near you. Set your trades and service area in your business profile so the right jobs show up first.' },
  { topic: 'bidding', who: 'h', q: 'How do I compare bids?', pages: ['marketplace'], a: 'Open your project from Projects and choose Compare bids. You see each price with insurance, ratings and work photos. Pick one to accept.' },
  { topic: 'bidding', who: 'c', q: 'How do I send a bid?', pages: ['marketplace'], a: 'Open a job, scroll to Your bid, add your price and what is included, and send. Your logo, insurance badge and ratings show on the bid.' },
  { topic: 'bidding', who: 'c', q: 'What does Bid as a team do?', a: 'Use it when a job needs more than one trade, or is bigger than you want to take alone. You and a local partner send one bid together, with each company\u2019s part and price. The homeowner sees one team bid with both names.' },
  { topic: 'bidding', who: 'c', q: 'How does Bid as a team work, step by step?', a: '1. Tap Bid as a team. 2. Pick a local partner for each trade the job needs. 3. Set each company\u2019s part and price. 4. Your partner confirms their part, or proposes a different price. 5. When you both agree, the team bid goes to the homeowner. Nothing is sent before that. Open Collaborate to follow it.' },
  { topic: 'bidding', who: 'c', q: 'Who can I team up with on a bid?', a: 'Local companies that Jobfile has verified, within 50 miles of the job. Both companies need a business ZIP code in their profile, and you must be verified too. A company that already has its own bid on the job cannot join a team bid for it.' },
  { topic: 'bidding', who: 'c', q: 'Do we get one contract or two?', a: 'You choose. With one contract, the lead holds it and pays the partner. With separate contracts, the homeowner hires each company directly, which suits unrelated trades such as painting and electrical. Jobfile only records payments. It does not hold or move money.' },
  { topic: 'bidding', who: 'both', q: 'What does the typical price range mean?', pages: ['marketplace'], a: 'It is a cost reference for similar work in the area, so you are not guessing. It is a guide, not a quote. Real prices depend on the job.' },
  { topic: 'bidding', who: 'c', q: 'Why does my profile matter?', pages: ['business'], a: 'Homeowners see your insurance badge, photos and ratings on every bid. A finished profile helps you win more jobs.' },
  { topic: 'payments', who: 'both', q: 'Does Jobfile hold or move money?', a: 'No. Jobfile records payments between the homeowner and contractor. Payment happens directly, the way you agreed.' },
  { topic: 'payments', who: 'c', q: 'How do I request a payment?', a: 'Open the project, go to Payments, and tap Request on the next milestone. The homeowner confirms once they have paid.' },
  { topic: 'payments', who: 'h', q: 'How do I confirm a payment?', a: 'When the contractor requests a milestone, you get a notice. Pay them directly, then confirm it in the project so both records match.' },
  { topic: 'payments', who: 'both', q: 'What is a change order?', a: 'Extra or changed work with a price. It is approved before the work starts and gets its own payment line, so nothing is a surprise at the end.' },
  { topic: 'visits', who: 'c', q: 'Can I see the job before I bid?', a: 'Yes, if the homeowner allows visits. Tap See the job first on the project and suggest times.' },
  { topic: 'visits', who: 'h', q: 'How do I set up a site visit?', a: 'When you post a project you choose whether visits are welcome and when you are free. Contractors then ask for a time, and you pick one that works.' },
  { topic: 'visits', who: 'both', q: 'Where do visits show up?', a: 'Confirmed visits appear on the project Schedule tab with a countdown, a calendar button and a reminder the day before.' },
  { topic: 'projects', who: 'both', q: 'What is the Needs you card?', pages: ['projects'], a: 'A short list of what is waiting on you, such as picking a visit time, approving a change, or signing the agreement.' },
  { topic: 'projects', who: 'both', q: 'How do I finish a project?', a: 'When the work is done, start closeout in the project. After it is complete, both sides can leave a rating.' },
  { topic: 'projects', who: 'h', q: 'What is the homestead notice?', a: 'A Texas step for work on your homestead. Jobfile shows it on the Overview and Agreement tabs so you can complete it before work begins.' },
  { topic: 'projects', who: 'both', q: 'What if we disagree about something?', a: 'Open the project and tap Report a problem. Say what happened and what would feel fair. The other side has 3 days to answer. You each suggest fixes, and when one of you accepts the other\u2019s, it is saved in the project. Nobody is blamed.' },
  { topic: 'projects', who: 'both', q: 'Can Jobfile decide who is right?', a: 'No. Jobfile does not hold money, give legal advice or rule on disputes. If you are stuck, you can ask a Jobfile mediator to read the record and send a recommendation. It only applies if you both accept it.' },
  { topic: 'trust', who: 'c', q: 'How do I verify my ID?', pages: ['business'], a: 'Open Business profile, then Verify your identity. Add a clear photo of your driver license or state ID. An AI service reads the name and expiry, then a Jobfile admin checks it. Your photo is deleted once it is checked and homeowners see only an ID verified badge.' },
  { topic: 'trust', who: 'both', q: 'What does ID verified mean?', a: 'A Jobfile admin checked a government photo ID for the business owner and the name matched. Jobfile does not keep or share the ID. It does not show a license or insurance.' },
  { topic: 'trust', who: 'c', q: 'How do I add my BBB or other credentials?', pages: ['business'], a: 'Open Business profile and scroll to Credentials. Pick the kind, add a link to your own listing or upload proof, and save. It shows right away as Stated by contractor, then Checked by Jobfile once an admin looks at it.' },
  { topic: 'trust', who: 'both', q: 'What does Checked by Jobfile mean on a credential?', a: 'A Jobfile admin looked at the contractor\u2019s proof or official listing. Stated by contractor means they say so and Jobfile has not checked it yet. Use the link to look it up yourself.' },
  { topic: 'trust', who: 'h', q: 'Who can see my address?', a: 'Your street address stays private until you hire a contractor. Bidders see only the general area.' },
  { topic: 'trust', who: 'both', q: 'What does Insured and verified mean?', pages: ['business'], a: 'The contractor has uploaded proof of insurance and it was checked. The badge shows the date it is good through.' },
  { topic: 'trust', who: 'c', q: 'Can I rate the homeowner?', a: 'Yes. After you mark a job complete, you can rate the homeowner on communication, quick decisions, paying on time and site access. Ratings stay hidden until both sides rate or 14 days pass.' },
  { topic: 'trust', who: 'h', q: 'Does the contractor rate me too?', a: 'Yes. Ratings go both ways. After a job is complete, the contractor rates you on communication, quick decisions, paying on time and site access. Both ratings stay hidden until you both rate or 14 days pass.' },
  { topic: 'trust', who: 'both', q: 'How do ratings work?', a: 'After a job is complete, the homeowner rates the contractor. Ratings build a public record for the contractor.' },
  { topic: 'team', who: 'c', q: 'What is Collaborate?', a: 'A way to bid on a job with another local pro, or to bring a partner onto a job you already won. Each company keeps its own business.' },
  { topic: 'team', who: 'c', q: 'How do I bid as a team?', a: 'On a job page tap Bid as a team, pick a local partner, set each company\u2019s part and price, and send. Your partner confirms their part first.' },
  { topic: 'team', who: 'c', q: 'Lead and partner, or separate contracts?', a: 'With one contract, the lead holds the contract and pays the partner. With separate contracts, the homeowner hires each company directly, which suits unrelated trades such as painting and electrical.' },
  { topic: 'team', who: 'c', q: 'How far away can a partner be?', a: 'Within 50 miles of the project. Both companies need a business ZIP code in their profile.' },
  { topic: 'team', who: 'c', q: 'What does a partner see?', a: 'Only their scope, price, dates and messages with you. They do not see the homeowner\u2019s phone or email. The lead stays the contact.' },
  { topic: 'team', who: 'c', q: 'What if my partner wants a different price?', a: 'They can propose a new one. You accept it or adjust. Nothing is sent to the homeowner until both of you agree.' },
  { topic: 'team', who: 'c', q: 'How do payments work with a partner?', a: 'Jobfile only records payments. The lead records payouts to partners. Jobfile does not hold or move money.' },
  { topic: 'team', who: 'c', q: 'What is Open to partnering?', a: 'A switch in Collaborate. It shows a badge on your profile so other contractors can find you and invite you.' },
  { topic: 'team', who: 'c', q: 'Can I invite someone who is not on Jobfile?', a: 'Yes. They get an email and join free. They only see their own part of the job.' },
  { topic: 'team', who: 'h', q: 'Can I remove a partner my contractor brought in?', a: 'Yes. In the project, open the Team section and tap Remove next to the partner. Your contractor stays your contact.' },
  { topic: 'start', who: 'both', pages: ['home'], q: 'What is on Home?', a: 'Open projects near you, a way to invite someone you already work with, and the app card. Your own projects are under Projects.' },
  { topic: 'projects', who: 'both', pages: ['projects'], q: 'What do the sections mean?', a: 'Homeowners see Needs you, Waiting for bids, Hired and ongoing, and Completed. Contractors see Find work, Needs you, Ongoing, Your bids and Completed.' },
  { topic: 'projects', who: 'both', pages: ['projects'], q: 'What does the red number on Projects mean?', a: 'Things waiting on you, such as a payment to confirm or a choice to make.' },
  { topic: 'projects', who: 'h', pages: ['projects'], q: 'How do I delete a draft?', a: 'On a draft card, tap Delete and confirm.' },
  { topic: 'projects', who: 'h', pages: ['projects'], q: 'What does I already have a contractor do?', a: 'Hired someone on your own? Add them to keep the agreement, photos, payments and messages in one place. They do not need a Jobfile account yet.' },
  { topic: 'bidding', who: 'h', pages: ['marketplace'], q: 'What does \u201cNew bid\u201d mean?', a: 'A bid that arrived since you last opened that project.' },
  { topic: 'bidding', who: 'h', pages: ['marketplace'], q: 'How long does a project stay open?', a: 'About 30 days. In the last 7 days you can tap Extend for 30 more.' },
  { topic: 'bidding', who: 'c', pages: ['marketplace'], q: 'How do I narrow the list?', a: 'Filter by kind of work and distance, and tap My bids to see yours.' },
  { topic: 'community', who: 'both', pages: ['community'], q: 'What is Community?', a: 'Finished projects people share, plus questions asking for ideas.' },
  { topic: 'community', who: 'both', pages: ['community'], q: 'How do I share a finished project?', a: 'Pick a finished project and a before and an after photo. The other side approves it, then Jobfile reviews. Only the city is shown.' },
  { topic: 'community', who: 'both', pages: ['community'], q: 'How do I share a tip?', a: 'Tap Share a tip, write a short trick from your own experience, and send it. Jobfile reviews it first, then you get an alert when it is live. People mark it Helpful.' },
  { topic: 'community', who: 'both', pages: ['community'], q: 'How do I ask for ideas?', a: 'Tap Ask for ideas, add a photo if you like, and add a poll with 2 to 4 choices.' },
  { topic: 'start', who: 'h', pages: ['find'], q: 'Who do I see here?', a: 'Contractors within 50 miles of your saved ZIP. You can filter by kind of work.' },
  { topic: 'start', who: 'h', pages: ['find'], q: 'How do I reach one?', a: 'Open their profile and tap Invite to bid, Ask a question or Start a project.' },
  { topic: 'start', who: 'h', pages: ['find'], q: 'Why can\u2019t I invite to bid?', a: 'Invites need an open project the contractor serves. Without one, start a project or ask a general question.' },
  { topic: 'start', who: 'both', pages: ['settings'], q: 'How do I change how I\u2019m alerted?', a: 'Choose Email and Text, and turn on phone alerts. Texts never include message content.' },
  { topic: 'start', who: 'both', pages: ['settings'], q: 'Why is my ZIP code here?', a: 'It shows contractors near you. Your street address is never shared.' },
  { topic: 'start', who: 'both', pages: ['settings'], q: 'Can I read messages in Spanish?', a: 'Yes. Pick your language, and new messages can be translated automatically. Translations are made by AI and can be imperfect.' },
  { topic: 'trust', who: 'c', pages: ['business'], q: 'How do I get the Verified and Insured badges?', a: 'Upload your insurance certificate in your Business profile. Once it is checked, the badge shows on every bid.' },
  { topic: 'trust', who: 'c', pages: ['business'], q: 'What is the profile meter?', a: 'How complete your profile is. A fuller profile wins more bids.' },
  { topic: 'start', who: 'both', pages: ['invite'], q: 'What does inviting do?', a: 'It gives you a link to send. You see only counts (opened, joined, posted a job), never who they are.' },
  { topic: 'design', who: 'h', pages: ['design'], q: 'What are design ideas?', a: 'Add a photo of a room and pick a style and finishes. You get two AI pictures of how it could look. They spark ideas to talk about with a contractor. They are not a plan and not a price.' },
  { topic: 'design', who: 'h', pages: ['design'], q: 'Which rooms and areas can I use?', a: 'Kitchen, Bathroom, Exterior, Living room, Bedroom, and Paint colors. Paint colors works for any room when you just want to see paint on the walls, trim or an accent wall.' },
  { topic: 'design', who: 'h', pages: ['design'], q: 'What makes a good photo?', a: 'Take the whole room from a corner in good light, straight on and not blurry. For the outside, stand back so the whole front of the house shows. Leave out people, faces, license plates and your street address.' },
  { topic: 'design', who: 'h', pages: ['design'], q: 'The choices do not have what I want. What can I do?', a: 'Every field has a Type your own link. Describe it in a few words, like dusty rose or white oak floors. The Anything else box takes longer notes.' },
  { topic: 'design', who: 'h', pages: ['design'], q: 'Why did it change things I did not pick?', a: 'The AI sometimes shifts small details. Try again with the same photo, or put what must stay the same in the Anything else box. Each set shows what was changed.' },
  { topic: 'design', who: 'h', pages: ['design'], q: 'How many ideas can I make?', a: 'Three sets a day, with two pictures in each set. The limit renews 24 hours after you made them. It can take around 30 seconds, so keep the page open.' },
  { topic: 'design', who: 'h', pages: ['design'], q: 'What happens to my photo?', a: 'It is sent to an outside AI service to make the pictures. Only you can see your ideas in Jobfile. Contractors see a picture only if you choose to share it when you post a project.' },
  { topic: 'design', who: 'h', pages: ['design'], q: 'How do I start a project from an idea?', a: 'Open your ideas and tap Start a project with this one under the picture you like. The Post page opens with the room type and matching items filled in. You choose whether contractors see the AI picture and your original photo.' },
  { topic: 'design', who: 'h', pages: ['design'], q: 'Is the AI picture a price or a promise?', a: 'No. It is a picture to spark conversation. Contractors bid on the work you describe, and the final look depends on materials, the room and the contractor.' },
];

/** Which topic to lead with, by page. */
export function topicForPath(path: string): HelpTopic | null {
  if (/^\/(collaborate|partner)/.test(path) || /^\/marketplace\/[^/]+\/team/.test(path) || /^\/projects\/[^/]+\/partners/.test(path)) return 'team';
  if (/^\/design/.test(path)) return 'design';
  if (/^\/marketplace\/new/.test(path)) return 'start';
  if (/^\/(marketplace|jobs)/.test(path)) return 'bidding';
  if (/\/(payments|money)/.test(path)) return 'payments';
  if (/\/schedule/.test(path)) return 'visits';
  if (/^\/projects/.test(path)) return 'projects';
  if (/^\/settings\/business/.test(path)) return 'trust';
  return null;
}

/** The Menu page the person is on, for page-specific help. Null on project tabs and anywhere without its own set. */
export function pageKey(path: string): PageKey | null {
  if (path === '/') return 'home';
  if (path === '/projects') return 'projects';
  if (path === '/marketplace') return 'marketplace';
  if (/^\/community/.test(path)) return 'community';
  if (path === '/find' || /^\/contractors\//.test(path)) return 'find';
  if (path === '/settings') return 'settings';
  if (path === '/settings/business') return 'business';
  if (path === '/invite') return 'invite';
  if (path === '/app') return 'app';
  if (/^\/design/.test(path)) return 'design';
  return null;
}
