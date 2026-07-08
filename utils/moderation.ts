// Tier 1: substring block after compact normalization (unambiguous terms)
const BRAND_TERMS = ['parqueen', 'parkqueen'];
const STRONG_RESERVED = [
    'admin', 'administrator', 'support', 'official', 'system', 'root',
    'security', 'firebase', 'backend', 'moderator', 'staff', 'owner',
    'founder', 'developer',
];

// Tier 2: exact token match only — avoids blocking "modernDriver", "devonParks", "steam"
const SHORT_RESERVED = ['mod', 'dev', 'api', 'team', 'help'];

const BANNED_WORDS = new Set([
    'fuck','fuk','fuq','fvck','shit','asshole','bitch','dick','pussy','cunt','damn','bastard','piss',
    'cock','tits','boobs','arse','bollocks','bugger','wanker','twat','prick','slut',
    'whore','skank','hoe','thot',
    'nigger','nigga','nigg','negro','chink','spic','wetback','kike','gook','raghead',
    'towelhead','cracker','honky','gringo','beaner','coon','darkie','jap','paki',
    'faggot','fag','dyke','tranny','shemale','retard','retarded','tard',
    'porn','porno','xxx','nsfw','hentai','milf','dildo','blowjob','handjob',
    'cumshot','orgasm','penis','vagina','clitoris','anus','anal','fellatio',
    'killyou','killyourself','kys','rape','molest','murder','terrorist','bomb',
    'puta','mierda','cono','verga','pendejo','cabron','chingada','culero','maricon',
]);

// Banned only as an exact full username (avoids false positives like "cassandra")
const BANNED_EXACT = new Set(['ass','fuk','fuq','cum','pee','poo']);

// Banned when they appear at the start OR end of a username (catches "bigass", "asshat", "bigcock")
const BANNED_AFFIXES = ['ass','cock','dick','tit','cum','piss','shit','fuck','cunt','slut','whore'];

// Compact normalization: l33tspeak substitutions + strip separators
function compactNormalize(str: string): string {
    return str.toLowerCase()
        .replace(/@/g, 'a')
        .replace(/0/g, 'o')
        .replace(/1/g, 'i')
        .replace(/!/g, 'i')
        .replace(/3/g, 'e')
        .replace(/\$/g, 's')
        .replace(/5/g, 's')
        .replace(/7/g, 't')
        .replace(/4/g, 'a')
        .replace(/8/g, 'b')
        .replace(/9/g, 'g')
        .replace(/[_\-.\s]/g, '');
}

// Token splitting: used for short ambiguous terms to avoid false positives
function tokenize(str: string): string[] {
    return str.toLowerCase().split(/[_\-.\s]+/).filter(Boolean);
}

export function checkBannedWords(text: string): boolean {
    const cleaned = compactNormalize(text);

    for (const word of BANNED_WORDS) {
        if (cleaned.includes(word)) return true;
    }

    if (BANNED_EXACT.has(cleaned)) return true;

    for (const affix of BANNED_AFFIXES) {
        if (cleaned.startsWith(affix) || cleaned.endsWith(affix)) return true;
    }

    return false;
}

// Two-tier impersonation check:
// Tier 1 — compact substring for brand + strong terms
// Tier 2 — exact token for short ambiguous terms
export function checkImpersonation(text: string): boolean {
    const compact = compactNormalize(text);

    for (const term of BRAND_TERMS) {
        if (compact.includes(term)) return true;
    }
    for (const term of STRONG_RESERVED) {
        if (compact.includes(term)) return true;
    }

    const tokens = tokenize(text);
    for (const term of SHORT_RESERVED) {
        if (tokens.includes(term)) return true;
    }

    return false;
}

const CONTACT_PATTERNS = [
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    /\b\d{7,}\b/,
    /\b[\w.+-]+@[\w-]+\.[\w.]+\b/,
    /https?:\/\/\S+/i,
    /\bwww\.\S+/i,
    /\b\S+\.(com|net|org|io|co|app|me|info)\b/i,
    /\b(instagram|snapchat|tiktok|whatsapp|telegram|signal|venmo|cashapp|zelle|paypal)\b/i,
    /\b(my\s*(ig|insta|snap|tik\s*tok|number|cell|phone))\b/i,
    /\b(add\s*me|hit\s*me\s*up|dm\s*me|text\s*me|call\s*me)\b/i,
];

export function checkContactInfo(text: string): boolean {
    for (const p of CONTACT_PATTERNS) {
        if (p.test(text)) return true;
    }
    return false;
}

export function moderateUsername(val: string): string | null {
    if (checkImpersonation(val)) return 'Please choose a different username.';
    if (checkBannedWords(val)) return 'Please choose a different username.';
    return null;
}

export function moderateDisplayName(val: string): string | null {
    if (checkImpersonation(val)) return "That name can't be used. Please choose another.";
    if (checkBannedWords(val)) return "That name can't be used. Please choose another.";
    return null;
}

export function moderateMessage(text: string): string | null {
    if (checkBannedWords(text)) return "This message couldn't be sent. Please revise and try again.";
    if (checkContactInfo(text)) return "This message couldn't be sent. Please revise and try again.";
    return null;
}
