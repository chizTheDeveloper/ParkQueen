'use strict';

// Shared server-side moderation core. Extracted verbatim from index.js so
// moderateContent (existing) and sendMessage (new authoritative write path)
// run the exact same banned-word/contact-info logic — no third independent
// implementation. Username-specific checks (checkImpersonation, brand/
// reserved-term lists) stay in index.js: they're out of scope for the chat
// message write-path fix and are shared with claimUsername.

const BANNED_WORDS = new Set([
  // English profanity
  "fuck","shit","asshole","bitch","dick","pussy","cunt","damn","bastard","piss",
  "cock","tits","boobs","arse","bollocks","bugger","wanker","twat","prick","slut",
  "whore","skank","hoe","thot",
  // Slurs & hate speech
  "nigger","nigga","nigg","negro","chink","spic","wetback","kike","gook","raghead",
  "towelhead","cracker","honky","gringo","beaner","coon","darkie","jap","paki",
  "faggot","fag","dyke","tranny","shemale","retard","retarded","tard",
  // Sexual/explicit
  "porn","porno","xxx","nsfw","hentai","milf","dildo","blowjob","handjob",
  "cumshot","orgasm","penis","vagina","clitoris","anus","anal","fellatio",
  // Violence
  "killyou","killyourself","kys","rape","molest","murder","terrorist","bomb",
  // Spanish profanity (NYC relevance)
  "puta","mierda","coño","verga","pendejo","cabron","chingada","culero","maricon",
]);

const CONTACT_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,  // phone numbers
  /\b\d{7,}\b/,                            // 7+ consecutive digits
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/,          // email
  /https?:\/\/\S+/i,                       // URLs
  /\bwww\.\S+/i,                           // www links
  /\b\S+\.(com|net|org|io|co|app|me|info)\b/i,  // bare domains
  /\b(instagram|snapchat|tiktok|whatsapp|telegram|signal|venmo|cashapp|zelle|paypal)\b/i,  // platform names
  /\b(my\s*(ig|insta|snap|tik\s*tok|number|cell|phone))\b/i,  // "my ig/snap" patterns
  /\b(add\s*me|hit\s*me\s*up|dm\s*me|text\s*me|call\s*me)\b/i,  // solicitation patterns
];

function normalizeText(str) {
  return str.toLowerCase()
    .replace(/@/g, 'a').replace(/0/g, 'o').replace(/1/g, 'i').replace(/!/g, 'i')
    .replace(/3/g, 'e').replace(/\$/g, 's').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/4/g, 'a').replace(/8/g, 'b').replace(/9/g, 'g')
    .replace(/[_\-.\s]/g, '');
}

function checkBannedWords(text) {
  const normalized = normalizeText(text);
  // Check each banned word as a substring of the normalized text
  for (const word of BANNED_WORDS) {
    if (normalized.includes(word)) return true;
  }
  return false;
}

function checkContactInfo(text) {
  for (const pattern of CONTACT_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

// Chat-message-specific combinator: banned words + contact/solicitation
// patterns — the exact pair moderateContent already applies when
// type === 'message'. Does not include checkImpersonation (username-only,
// stays in index.js).
function moderateMessageServer(text) {
  if (checkBannedWords(text)) return { allowed: false, reason: 'inappropriate_content' };
  if (checkContactInfo(text)) return { allowed: false, reason: 'contact_info' };
  return { allowed: true, reason: null };
}

module.exports = { checkBannedWords, checkContactInfo, normalizeText, moderateMessageServer };
