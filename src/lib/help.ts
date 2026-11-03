export const HELP_PER_DAY = 5;

export const TOPICS: [string, string][] = [
  ['question', 'A question'],
  ['problem', 'Something is not working'],
  ['idea', 'An idea'],
  ['report', 'Report a person or post'],
];
export const topicLabel = (t: string) => TOPICS.find(([k]) => k === t)?.[1] ?? 'A question';
export const isTopic = (t: string) => TOPICS.some(([k]) => k === t);

/** Quick answers shown above the form. Edit the wording here. */
export const FAQ: [string, string][] = [
  ['Is Jobfile really free?', 'Yes. Free to join, no subscription, no fees at all.'],
  ['How do I post a job?', 'Tap Post, pick the kind of job, tap what you want done, and add photos. Local contractors send bids.'],
  ['Who can see my address?', 'Only the contractor you hire. Contractors who bid see your ZIP code and first name.'],
  ['How do payments work?', 'Jobfile records milestone payments. You pay your contractor directly, and both sides confirm it in the record.'],
  ['A contractor asked for my phone number', 'You do not have to share it before you hire someone. Keep chatting in Jobfile, and report anything that feels off.'],
  ['How do I change or delete my account?', 'Open Menu, then Settings, to change your details. To delete your account, send us a message here and choose "A question".'],
];
