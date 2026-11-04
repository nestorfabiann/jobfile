/** Ready answers for the Help button. Plain text only. Keep each answer short and true to how the app works today. */
export type HelpTopic = 'start' | 'bidding' | 'payments' | 'visits' | 'projects' | 'trust';
export type HelpItem = { q: string; a: string; topic: HelpTopic; who: 'h' | 'c' | 'both' };

export const TOPICS: [HelpTopic, string][] = [
  ['start', 'Getting started'],
  ['bidding', 'Bidding'],
  ['payments', 'Payments'],
  ['visits', 'Visits'],
  ['projects', 'Projects'],
  ['trust', 'Trust and privacy'],
];

export const HELP: HelpItem[] = [
  { topic: 'start', who: 'both', q: 'What is Jobfile?', a: 'A place where homeowners post projects and compare bids from local contractors, then keep the price, photos, schedule and payments for the job in one shared record.' },
  { topic: 'start', who: 'both', q: 'Does it cost anything?', a: 'Jobfile is free to start. There is no subscription, and nothing is taken from jobs you win.' },
  { topic: 'start', who: 'both', q: 'Already have a contractor or a customer?', a: 'You do not need the marketplace. Start a project, send an invite by email, and they join with one tap. The person you invite does not need an account first.' },
  { topic: 'start', who: 'h', q: 'How do I get bids?', a: 'Tap Post a project, choose the work, add photos and a budget, and publish. Contractors near you can then send bids, and you compare them side by side.' },
  { topic: 'start', who: 'c', q: 'How do I find work?', a: 'Open Find work to see open projects near you. Set your trades and service area in your business profile so the right jobs show up first.' },
  { topic: 'bidding', who: 'h', q: 'How do I compare bids?', a: 'Open your project from Projects and choose Compare bids. You see each price with insurance, ratings and work photos. Pick one to accept.' },
  { topic: 'bidding', who: 'c', q: 'How do I send a bid?', a: 'Open a job, scroll to Your bid, add your price and what is included, and send. Your logo, insurance badge and ratings show on the bid.' },
  { topic: 'bidding', who: 'both', q: 'What does the typical price range mean?', a: 'It is a cost reference for similar work in the area, so you are not guessing. It is a guide, not a quote. Real prices depend on the job.' },
  { topic: 'bidding', who: 'c', q: 'Why does my profile matter?', a: 'Homeowners see your insurance badge, photos and ratings on every bid. A finished profile helps you win more jobs.' },
  { topic: 'payments', who: 'both', q: 'Does Jobfile hold or move money?', a: 'No. Jobfile records payments between the homeowner and contractor. Payment happens directly, the way you agreed.' },
  { topic: 'payments', who: 'c', q: 'How do I request a payment?', a: 'Open the project, go to Payments, and tap Request on the next milestone. The homeowner confirms once they have paid.' },
  { topic: 'payments', who: 'h', q: 'How do I confirm a payment?', a: 'When the contractor requests a milestone, you get a notice. Pay them directly, then confirm it in the project so both records match.' },
  { topic: 'payments', who: 'both', q: 'What is a change order?', a: 'Extra or changed work with a price. It is approved before the work starts and gets its own payment line, so nothing is a surprise at the end.' },
  { topic: 'visits', who: 'c', q: 'Can I see the job before I bid?', a: 'Yes, if the homeowner allows visits. Tap See the job first on the project and suggest times.' },
  { topic: 'visits', who: 'h', q: 'How do I set up a site visit?', a: 'When you post a project you choose whether visits are welcome and when you are free. Contractors then ask for a time, and you pick one that works.' },
  { topic: 'visits', who: 'both', q: 'Where do visits show up?', a: 'Confirmed visits appear on the project Schedule tab with a countdown, a calendar button and a reminder the day before.' },
  { topic: 'projects', who: 'both', q: 'What is the Needs you card?', a: 'A short list of what is waiting on you, such as picking a visit time, approving a change, or signing the agreement.' },
  { topic: 'projects', who: 'both', q: 'How do I finish a project?', a: 'When the work is done, start closeout in the project. After it is complete, both sides can leave a rating.' },
  { topic: 'projects', who: 'h', q: 'What is the homestead notice?', a: 'A Texas step for work on your homestead. Jobfile shows it on the Overview and Agreement tabs so you can complete it before work begins.' },
  { topic: 'trust', who: 'h', q: 'Who can see my address?', a: 'Your street address stays private until you hire a contractor. Bidders see only the general area.' },
  { topic: 'trust', who: 'both', q: 'What does Insured and verified mean?', a: 'The contractor has uploaded proof of insurance and it was checked. The badge shows the date it is good through.' },
  { topic: 'trust', who: 'c', q: 'Can I rate the homeowner?', a: 'Yes. After you mark a job complete, you can rate the homeowner on communication, quick decisions, paying on time and site access. Ratings stay hidden until both sides rate or 14 days pass.' },
  { topic: 'trust', who: 'h', q: 'Does the contractor rate me too?', a: 'Yes. Ratings go both ways. After a job is complete, the contractor rates you on communication, quick decisions, paying on time and site access. Both ratings stay hidden until you both rate or 14 days pass.' },
  { topic: 'trust', who: 'both', q: 'How do ratings work?', a: 'After a job is complete, the homeowner rates the contractor. Ratings build a public record for the contractor.' },
];

/** Which topic to lead with, by page. */
export function topicForPath(path: string): HelpTopic | null {
  if (/^\/marketplace\/new/.test(path)) return 'start';
  if (/^\/(marketplace|jobs)/.test(path)) return 'bidding';
  if (/\/(payments|money)/.test(path)) return 'payments';
  if (/\/schedule/.test(path)) return 'visits';
  if (/^\/projects/.test(path)) return 'projects';
  if (/^\/settings\/business/.test(path)) return 'trust';
  return null;
}
