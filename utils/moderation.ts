const RESERVED = new Set([
    'admin','support','parqueen','parkqueen','system','moderator','official','help',
    'info','contact','team','staff','root','null','undefined','test','api','www','app',
    'mod','owner','ceo','founder','parking','driver','police','nypd','nyc',
]);

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

function normalize(str: string): string {
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

export function checkBannedWords(text: string): boolean {
    const cleaned = normalize(text);

    // Substring match — catches compound dirty words that are clearly bad in any position
    for (const word of BANNED_WORDS) {
        if (cleaned.includes(word)) return true;
    }

    // Exact match — catches standalone words that are fine as substrings (e.g. "ass" in "cassandra")
    if (BANNED_EXACT.has(cleaned)) return true;

    // Affix match — catches compound usernames like "bigass", "asshat", "bigcock"
    for (const affix of BANNED_AFFIXES) {
        if (cleaned.startsWith(affix) || cleaned.endsWith(affix)) return true;
    }

    return false;
}

export function checkReservedUsername(text: string): boolean {
    return RESERVED.has(text.toLowerCase());
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
    if (checkReservedUsername(val)) return 'This username is not available';
    if (checkBannedWords(val)) return 'This username is not available';
    return null;
}

export function moderateMessage(text: string): string | null {
    if (checkBannedWords(text)) return "This message couldn't be sent. Please revise and try again.";
    if (checkContactInfo(text)) return "This message couldn't be sent. Please revise and try again.";
    return null;
}
