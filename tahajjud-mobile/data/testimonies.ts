export interface Testimony {
    id: string;
    title: string;
    body: string;
    author: string;
    location: string;
    reactions: number;
    tags: string[];
    /** Set on stories fetched from the community collection — used to rank
     *  real user posts above the bundled seed stories. */
    isCommunity?: boolean;
    /** Epoch millis; only present on community stories. */
    createdAt?: number;
    /** Denormalised count of visible replies (community stories only). */
    replyCount?: number;
    /** Cached on-demand translations of `body`, keyed by Locale code —
     * community stories only. See utils/translate.ts. */
    translations?: Record<string, string>;
}

export const initialTestimonies: Testimony[] = [
    // ── Career / Rizq ──────────────────────────────────────────────
    {
        id: '1',
        title: "The Job I Prayed For",
        body: "I was unemployed for 2 years. Rejections piled up, and I felt worthless. Then I started waking up 20 minutes before Fajr. I poured my heart out in Sujood. Two weeks later, I got a call for a job that was better than anything I applied for. Tahajjud opened doors that were sealed shut.",
        author: "Anonymous",
        location: "London, UK",
        reactions: 23,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c2',
        title: "From Debt to Abundance",
        body: "We were in serious debt and I was not sleeping well anyway. A friend talked to me about tahajjud — not as a solution but as a way to stop carrying it alone. I started getting up and praying and it genuinely helped me think more clearly during the day. I stopped making panicked decisions. An old client came back with work around that time. I can't say the tahajjud caused it. I can say I was in a better state to handle things because of it.",
        author: "Tariq M.",
        location: "Birmingham, UK",
        reactions: 8,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c3',
        title: "Promotion After 5 Years",
        body: "I was passed over for promotion three times and I was starting to lose it — the bitterness was eating me up. I started praying tahajjud not really expecting a promotion, more just needing somewhere to put all of it. What changed first was the bitterness. It slowly went. I stopped competing with my colleagues in my head. A few months later I was promoted but honestly the better thing was what had already changed before that.",
        author: "Fatimah A.",
        location: "Toronto, Canada",
        reactions: 13,
        tags: ["Career"]
    },
    {
        id: 'c4',
        title: "The Business That Survived",
        body: "COVID nearly finished my restaurant. I was weeks away from closing. I started praying tahajjud out of desperation, just crying about it honestly. Then a local council grant came through that I'd half-forgotten I applied for. It bought me enough time to get through it. The restaurant is still open. I don't take that lightly.",
        author: "Ibrahim O.",
        location: "Manchester, UK",
        reactions: 12,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c5',
        title: "Visa Approved After 3 Rejections",
        body: "My visa had been rejected twice and I was exhausted and embarrassed. My mum sat me down and talked to me seriously about putting it in Allah's hands — properly, not just saying the words. She got me up for tahajjud herself the first few nights. I remember crying during sujood in a way I hadn't in years. The third application went through. I don't know if it was what I said or just what I felt for the first time.",
        author: "Amira N.",
        location: "Atlanta, USA",
        reactions: 26,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c6',
        title: "A Salary I Never Expected",
        body: "I'd been applying for months and was about to accept something just to have income. I felt beaten down and kept waking at night with anxiety about it. Eventually I started using that time to pray instead of just worrying. It didn't fix the anxiety immediately — but I started feeling less desperate, like I wasn't completely alone in it. A few weeks later a better offer came. Whether that was the tahajjud or the timing I can't say for certain. But I know how I felt those nights.",
        author: "Yusuf K.",
        location: "Minneapolis, USA",
        reactions: 24,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c7',
        title: "Starting My Own Business",
        body: "I had an idea but no courage. For months I prayed Tahajjud asking Allah for a sign. A mentor appeared out of nowhere, offered to invest, and told me to 'just start.' That was three years ago. Alhamdulillah, my business now employs 12 people.",
        author: "Maryam B.",
        location: "London, UK",
        reactions: 33,
        tags: ["Career"]
    },
    {
        id: 'c8',
        title: "Published After Years of Rejection",
        body: "Every publisher rejected my manuscript and I was running out of steam. The rejections were fine — it was the silence between them that was killing me. I started praying tahajjud during that period, mostly to keep going. Not asking for a publishing deal specifically, just asking Allah not to let me give up on something I believed in. I kept writing. Eventually something came through. The tahajjud didn't open doors — it kept me at the desk long enough for the doors to open.",
        author: "Zainab H.",
        location: "New Jersey, USA",
        reactions: 9,
        tags: ["Career", "Success"]
    },
    {
        id: 'c9',
        title: "Saved From a Bad Contract",
        body: "I was about to sign a business deal that looked good on paper. Something made me pray Tahajjud that night. In the morning I felt strongly not to sign. Two weeks later, the company went bankrupt and everyone who signed lost everything. Tahajjud protected me from what I couldn't see.",
        author: "Bilal S.",
        location: "Dubai, UAE",
        reactions: 17,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c10',
        title: "Found My Calling in the Night Hours",
        body: "I hated my job for years but didn't know what else to do. In the quiet of Tahajjud I finally listened to what my heart was saying. I retrained, changed careers, and now wake up excited to work. The direction I needed was always there — I just needed the silence of the night to hear it.",
        author: "Hana R.",
        location: "Toronto, Canada",
        reactions: 8,
        tags: ["Career"]
    },
    {
        id: 'c11',
        title: "A Scholarship From Nowhere",
        body: "My family couldn't afford university and I'd basically accepted that. I wasn't even praying tahajjud for a scholarship specifically — I was praying because I felt stuck and needed direction. Someone at my college told me about a scholarship I hadn't considered applying for because it seemed out of reach. I applied. I got it. I think Allah put that person in my path at the right moment. The tahajjud wasn't a transaction. It just kept me moving toward something when I felt like stopping.",
        author: "Omar F.",
        location: "Leicester, UK",
        reactions: 12,
        tags: ["Career", "Education"]
    },
    {
        id: 'c12',
        title: "The Freelance Career That Took Off",
        body: "I left a secure job to freelance and for months had almost no clients. I started waking at 3am not out of discipline but desperation. Within weeks, referrals started flooding in. Today I earn more than I ever did. I believe those late-night duas were the turning point.",
        author: "Nadia P.",
        location: "Auckland, New Zealand",
        reactions: 19,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c13',
        title: "Lost My Job, Found My Purpose",
        body: "Being made redundant felt like a disaster. I started praying Tahajjud out of grief. Slowly I realised it was the push I needed. I launched the non-profit I'd been dreaming about. Today we've helped over 500 families. What looked like a loss was the best thing Allah ever gave me.",
        author: "Khalid J.",
        location: "Birmingham, UK",
        reactions: 8,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c14',
        title: "Negotiated My Worth",
        body: "I was underpaid for years, too scared to negotiate. After months of Tahajjud I felt a quiet confidence I'd never had before. I walked into my boss's office and asked for what I deserved. He said yes without hesitation. Sometimes rizq is behind a conversation you've been afraid to have.",
        author: "Safia L.",
        location: "Sheffield, UK",
        reactions: 12,
        tags: ["Career"]
    },
    {
        id: 'c15',
        title: "Business Partner Sent by Allah",
        body: "Running the business alone was grinding me down and I didn't have anyone to talk through decisions with. I started praying tahajjud during a particularly hard stretch and found it helped me think more clearly — like the night gave me a bit of perspective I couldn't get during the day. I met someone at a work event a few months later who I ended up going into partnership with. It's worked out well. I don't think tahajjud found me a business partner. I think it put me in the right headspace to recognise one when I met him.",
        author: "Faris T.",
        location: "New York, USA",
        reactions: 23,
        tags: ["Career", "Rizq"]
    },

    // ── Marriage / Family ───────────────────────────────────────────
    {
        id: '3',
        title: "A Broken Marriage Restored",
        body: "We were on the brink of divorce. Arguments every day. I started praying Tahajjud specifically for our hearts to soften. Slowly, the anger faded. We started communicating again. It's been a year, and we are happier than ever. Allah turns hearts.",
        author: "Anonymous",
        location: "Dubai, UAE",
        reactions: 20,
        tags: ["Marriage", "Family"]
    },
    {
        id: 'm2',
        title: "My Child Came Home",
        body: "My son had been estranged for 3 years. I cried over him in every Tahajjud for months. One ordinary Tuesday morning he called and said he wanted to come home. I don't know what changed in his heart but I know what changed in mine — and I believe Allah linked them.",
        author: "Um Khalid",
        location: "Dearborn, USA",
        reactions: 12,
        tags: ["Family"]
    },
    {
        id: 'm3',
        title: "Finding the Right Spouse",
        body: "I was 35 and the loneliness had become really heavy. I started praying tahajjud not as a strategy but because I needed somewhere honest to take it. I'd sit after prayer and just talk to Allah about how I actually felt — not a rehearsed dua, just real. Something in that honesty changed me. I became less anxious about it, less desperate. Met someone not long after. I'm not sure the tahajjud worked like a request form. I think it worked by changing me.",
        author: "Nour A.",
        location: "London, UK",
        reactions: 21,
        tags: ["Marriage"]
    },
    {
        id: 'm4',
        title: "Infertility and a Miracle",
        body: "After 6 years of trying, 3 rounds of IVF, and countless heartbreaks, I began Tahajjud with a desperation I'd never felt before. I stopped asking 'why me' and just asked Allah for His mercy. Our daughter was born eight months later. Some gifts come only when we've exhausted every other door.",
        author: "Anonymous",
        location: "Sydney, Australia",
        reactions: 29,
        tags: ["Family", "Health"]
    },
    {
        id: 'm5',
        title: "My Parents Reconciled",
        body: "My parents separated when I was a teenager and hadn't spoken in years. I prayed tahajjud for their reconciliation. They've since remarried each other. I genuinely did not think this was possible. With Allah, nothing is impossible.",
        author: "Hamza R.",
        location: "Montreal, Canada",
        reactions: 8,
        tags: ["Marriage", "Family"]
    },
    {
        id: 'm6',
        title: "A Difficult Mother-in-Law",
        body: "My relationship with my mother-in-law was poisoning my marriage. Instead of complaining, I started making dua for her in Tahajjud — genuinely asking Allah to bless her. Something shifted. She called me one day to apologise unprompted. That call changed everything.",
        author: "Leila M.",
        location: "Edinburgh, UK",
        reactions: 29,
        tags: ["Marriage", "Family"]
    },
    {
        id: 'm7',
        title: "Healing After Betrayal",
        body: "I found out my spouse had been lying to me for years. I was shattered. I didn't know if I could forgive or continue. Tahajjud became my rebuilding. Slowly, I found the strength not just to decide what to do but to be at peace with it. Allah alone heals what people break.",
        author: "Anonymous",
        location: "USA",
        reactions: 25,
        tags: ["Marriage", "Forgiveness"]
    },
    {
        id: 'm8',
        title: "Reconnecting With My Father",
        body: "My father and I hadn't spoken properly in a decade. I started praying for him specifically in tahajjud. Six months later, he called me out of nowhere, voice full of emotion, asking if we could start fresh. He told me he'd been feeling a pull toward reconciliation for months. SubhanAllah.",
        author: "Saud K.",
        location: "Houston, USA",
        reactions: 15,
        tags: ["Family"]
    },
    {
        id: 'm9',
        title: "The Wedding That Almost Didn't Happen",
        body: "Our families were against the marriage and we had pressure from both sides to just give up. I prayed tahajjud and made niyyah to accept whatever Allah decided. Over the next few weeks things slowly shifted. Her dad came around first, then mine. I don't know what changed their minds. Neither of them could really explain it either.",
        author: "Aya and Mostafa",
        location: "Dallas, USA",
        reactions: 11,
        tags: ["Marriage"]
    },
    {
        id: 'm10',
        title: "Patience With a Struggling Sibling",
        body: "My brother's addiction was tearing our family apart. I made dua for him every night in tahajjud — not to change him, but for Allah to guide him. He entered rehab last year without any pressure from us. He said one morning he just 'woke up and knew.' I know why.",
        author: "Anonymous",
        location: "Toronto, Canada",
        reactions: 38,
        tags: ["Family"]
    },
    {
        id: 'm11',
        title: "The Rift With My Sister Healed",
        body: "My sister and I had a falling out over inheritance and didn't speak for two years. I started making dua for her in tahajjud, asking Allah to remove the bitterness from my heart first. One day I woke up and simply had no more resentment. I called her. She was waiting for me to call.",
        author: "Layla F.",
        location: "Melbourne, Australia",
        reactions: 15,
        tags: ["Family", "Forgiveness"]
    },
    {
        id: 'm12',
        title: "My Son Returned to the Deen",
        body: "My teenage son stopped praying and I feared losing him completely. Rather than lecture him more, I started praying for him in Tahajjud every night. One Ramadan he stood up to pray without me asking. He's now more religious than I was at his age. Dua does what words cannot.",
        author: "Um Ibrahim",
        location: "Brisbane, Australia",
        reactions: 9,
        tags: ["Family"]
    },
    {
        id: 'm13',
        title: "A Marriage That Became a Partnership",
        body: "My husband and I had grown apart. We were two people living parallel lives. I prayed tahajjud specifically for our connection to deepen. He started joining me for Fajr. Then we started talking. Now we have weekly date nights and I feel more in love than when we married.",
        author: "Mariam Z.",
        location: "Houston, USA",
        reactions: 9,
        tags: ["Marriage"]
    },
    {
        id: 'm14',
        title: "Praying Together Changed Us",
        body: "I asked my husband to try tahajjud together for 30 nights as a challenge. We've been doing it for two years now. The 3am conversations after prayer have become the most important conversations of our marriage. We say things in the dark we could never say in the daylight.",
        author: "Hana and Rami",
        location: "Dearborn, USA",
        reactions: 31,
        tags: ["Marriage"]
    },
    {
        id: 'm15',
        title: "For a Righteous Child",
        body: "When I was pregnant I started praying tahajjud regularly for the first time. I don't know exactly what I was asking for — just that the child would grow up with something real inside them, not just going through motions. My daughter is 12 now. She's not perfect and neither am I. But I see something in her that I think comes from those nights. Maybe I'm imagining it. Maybe not.",
        author: "Um Abdullah",
        location: "New York, USA",
        reactions: 22,
        tags: ["Family"]
    },

    // ── Anxiety / Health ────────────────────────────────────────────
    {
        id: '2',
        title: "Peace in the Chaos",
        body: "My anxiety was crippling. I couldn't sleep. One night, instead of tossing and turning, I made wudu and prayed. The silence of the night combined with the words of Allah healed something in me. Now, Tahajjud is my therapy. The anxiety is gone, replaced by a peace I can't explain.",
        author: "Sarah K.",
        location: "Toronto, Canada",
        reactions: 29,
        tags: ["Anxiety", "Health", "Peace"]
    },
    {
        id: 'h2',
        title: "The Panic Attacks Stopped",
        body: "I had panic attacks for three years. Medication helped but never fully solved it. A therapist suggested adding spiritual practice. I started tahajjud. After two months the panic attacks became rare. After six months they were gone. I'm not saying it was only this — but I know it was the missing piece.",
        author: "Rashid M.",
        location: "New York, USA",
        reactions: 26,
        tags: ["Anxiety", "Health"]
    },
    {
        id: 'h3',
        title: "Depression Lifted at 3am",
        body: "Clinical depression had taken everything from me. I couldn't work, couldn't function. In my darkest hour I dragged myself to pray Tahajjud, not because I believed it would help, but because I had nothing left to lose. Slowly, something began to shift. A year later I am a different person.",
        author: "Anonymous",
        location: "Birmingham, UK",
        reactions: 20,
        tags: ["Anxiety", "Health", "Peace"]
    },
    {
        id: 'h4',
        title: "Cancer, Chemo, and Calm",
        body: "During chemotherapy I had every reason to fall apart. But my tahajjud became my anchor. I'd wake at 3am, weak and nauseous, and somehow in those moments of connection with Allah I found a peace that my doctors couldn't explain. I'm in remission now and I believe prayer was part of my medicine.",
        author: "Aisha T.",
        location: "Cape Town, South Africa",
        reactions: 40,
        tags: ["Health"]
    },
    {
        id: 'h5',
        title: "Insomnia Became Ibadah",
        body: "I couldn't sleep for years. Doctors tried everything. Then I decided to use my wakeful hours for tahajjud. The insomnia didn't disappear immediately but the dread of it did. Eventually my sleep regulated. What I once cursed became the best part of my life.",
        author: "Huda N.",
        location: "Nottingham, UK",
        reactions: 16,
        tags: ["Health", "Peace"]
    },
    {
        id: 'h6',
        title: "A Chronic Illness and Patience",
        body: "I have a chronic condition that will never fully go away. I used to rage against it. Tahajjud taught me to accept it. To still be grateful. To find the barakah in limitations. I am not healed, but I am at peace — and that is a different kind of miracle.",
        author: "Anonymous",
        location: "Glasgow, UK",
        reactions: 20,
        tags: ["Health", "Peace"]
    },
    {
        id: 'h7',
        title: "Before the Surgery",
        body: "The night before a serious surgery I couldn't sleep anyway. I prayed tahajjud and just asked Allah to take care of it. The surgery went well — better than the doctors expected. I'm recovering now. I don't have a dramatic story. I just know I was calmer going in than I had any right to be.",
        author: "Abdullah S.",
        location: "Phoenix, USA",
        reactions: 30,
        tags: ["Health"]
    },
    {
        id: 'h8',
        title: "Mental Clarity I Couldn't Buy",
        body: "Years of stress had left me mentally foggy. I couldn't focus, make decisions, or think clearly. After 3 months of consistent tahajjud my mind cleared. I don't know the mechanism — I just know that the morning after tahajjud I think differently. Clearer, calmer, sharper.",
        author: "Khalil A.",
        location: "Montreal, Canada",
        reactions: 22,
        tags: ["Anxiety", "Health"]
    },
    {
        id: 'h9',
        title: "My Brother's Recovery",
        body: "My brother was in a coma after an accident. The doctors weren't hopeful at all. We prayed tahajjud as a family in the hospital — in the corridor, wherever we could find space. He woke up after 11 days. The doctors were surprised, said his recovery was faster than expected. We weren't surprised.",
        author: "Yasmine A.",
        location: "Ottawa, Canada",
        reactions: 32,
        tags: ["Health", "Family"]
    },
    {
        id: 'h10',
        title: "When Grief Became Gratitude",
        body: "I lost my mum suddenly. For months I'd wake up in the night just destroyed. I started going to pray instead of just lying there. I'd cry the whole way through. But slowly, over time, the crying started to feel different. Less like pain, more like missing her. More like being grateful I had her at all. Tahajjud didn't take the grief away. It just changed what it felt like.",
        author: "Ismail O.",
        location: "Detroit, USA",
        reactions: 21,
        tags: ["Anxiety", "Peace", "Family"]
    },
    {
        id: 'h11',
        title: "Fear of the Future Gone",
        body: "I was paralysed by anxiety about the future — finances, health, relationships. I'd wake at 3am gripped by fear. Then I started channelling those hours into tahajjud instead of worry. Slowly the fear lost its power. I realised that if I'm talking to the One who controls the future, what exactly am I afraid of?",
        author: "Safiya B.",
        location: "Columbus, USA",
        reactions: 25,
        tags: ["Anxiety", "Peace"]
    },
    {
        id: 'h12',
        title: "Fertility After Being Told No",
        body: "Doctors told us we'd need IVF and we couldn't afford it. We'd basically accepted it wasn't going to happen. I started praying tahajjud regularly and just putting it in Allah's hands. My wife fell pregnant naturally a few months later. The doctor actually double-checked the test. We still can't fully explain it and we don't really try.",
        author: "Musa K.",
        location: "Perth, Australia",
        reactions: 8,
        tags: ["Health", "Family"]
    },
    {
        id: 'h13',
        title: "The Addiction I Couldn't Break",
        body: "I had a private addiction I was ashamed to tell anyone. I tried to stop alone for years. One night in desperation I prayed tahajjud and was completely honest with Allah about everything. That was the turning point. No programme, no counsellor — just total honesty in the dark and a mercy that I did not deserve.",
        author: "Anonymous",
        location: "USA",
        reactions: 12,
        tags: ["Health", "Forgiveness"]
    },
    {
        id: 'h14',
        title: "Night Prayers Replaced Night Scrolling",
        body: "I was addicted to my phone at night. Sleep deprivation was destroying my health. Replacing late night scrolling with tahajjud was the best trade I ever made. My sleep improved, my focus returned, my anxiety reduced. Sometimes healing is simply replacing one habit with another.",
        author: "Nadia R.",
        location: "Vancouver, Canada",
        reactions: 14,
        tags: ["Anxiety", "Health"]
    },
    {
        id: 'h15',
        title: "Healing From a Toxic Relationship",
        body: "Leaving an abusive relationship left me broken. I didn't trust myself or anyone else. Tahajjud became my rebuilding. In those quiet hours I talked to Allah about things I couldn't say aloud. Slowly I began to heal. Two years on, I am strong, whole, and grateful for the journey.",
        author: "Anonymous",
        location: "Manchester, UK",
        reactions: 9,
        tags: ["Anxiety", "Health", "Forgiveness"]
    },

    // ── Forgiveness / Spiritual ─────────────────────────────────────
    {
        id: '5',
        title: "Forgiving Myself",
        body: "I carried guilt for years over past mistakes. I felt too ashamed to ask for forgiveness. But in the quiet of the night, I realized Allah's mercy is bigger than my sins. Crying in Tahajjud washed away the guilt. I finally feel free.",
        author: "Anonymous",
        location: "USA",
        reactions: 12,
        tags: ["Forgiveness", "Spiritual"]
    },
    {
        id: 'f2',
        title: "Returning After Years Away",
        body: "I had left Islam in my late teens. For years I felt lost. In my 30s, at my lowest point, I remembered a Tahajjud my grandmother used to pray. I tried it. In that prayer, I felt something I hadn't felt in 15 years — that I was known, heard, and loved. I never left again.",
        author: "Anonymous",
        location: "London, UK",
        reactions: 9,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'f3',
        title: "Forgiving the Unforgivable",
        body: "Someone wronged me deeply. I carried hatred for years. A scholar told me that carrying resentment only harms the one carrying it, and that dua for your enemy in tahajjud is among the most powerful acts. I forced myself to make dua for them. My hatred dissolved. My heart was the one that was freed.",
        author: "Anonymous",
        location: "Washington DC, USA",
        reactions: 13,
        tags: ["Forgiveness", "Spiritual"]
    },
    {
        id: 'f4',
        title: "The Night I Almost Gave Up on Allah",
        body: "I don't say this lightly — I was on the verge of losing my faith. I prayed one last prayer in the dark, half-accusing, half-pleading. Something in that prayer broke open. I felt a presence I cannot describe. I wept for an hour. I've never doubted since. Sometimes the darkest dua is the most powerful.",
        author: "Anonymous",
        location: "Brisbane, Australia",
        reactions: 23,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'f5',
        title: "When Khushoo Finally Came",
        body: "For years I prayed but felt nothing. My salah was mechanical. I started doing tahajjud and something about the silence and darkness changed everything. Tears came for the first time. I felt the words of the Quran for the first time. The khushoo I had been chasing for years arrived when I stopped chasing it.",
        author: "Hamid L.",
        location: "Boston, USA",
        reactions: 15,
        tags: ["Spiritual"]
    },
    {
        id: 'f6',
        title: "Reconciling With God After Loss",
        body: "I was angry at Allah after losing my child. I won't pretend I wasn't. But I came back to prayer because I had nowhere else to take my grief. In the silence of Tahajjud I told Allah exactly how I felt. And somehow, in that honesty, healing began. He can handle our anger. He just wants us to come.",
        author: "Anonymous",
        location: "Toronto, Canada",
        reactions: 15,
        tags: ["Spiritual", "Forgiveness", "Family"]
    },
    {
        id: 'f7',
        title: "Letting Go of Envy",
        body: "I was consumed by envy of others' success. I hated that about myself. I started making dua in tahajjud for the people I envied — genuinely asking for blessings for them. The envy evaporated. I realised envy had been blocking my own blessings. Dua for others is really dua for yourself.",
        author: "Sana M.",
        location: "Dallas, USA",
        reactions: 12,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'f8',
        title: "Reading Quran With New Eyes",
        body: "I had read Quran my whole life without it truly affecting me. After starting tahajjud regularly, I opened the Mushaf one morning and every ayah seemed to speak directly to my situation. I cried through three surahs. The book hadn't changed — I had.",
        author: "Yusra A.",
        location: "Leeds, UK",
        reactions: 13,
        tags: ["Spiritual"]
    },
    {
        id: 'f9',
        title: "The Peace That Doesn't Make Sense",
        body: "Everything in my life was hard at the time. Job stress, family problems, financial pressure. But people kept asking me why I seemed so calm. Honestly the only thing I was doing differently was tahajjud. There's something that happens to you when you pray consistently in the night that I genuinely can't put into words. I've stopped trying to explain it. It's just there.",
        author: "Amira K.",
        location: "Calgary, Canada",
        reactions: 36,
        tags: ["Spiritual", "Peace"]
    },
    {
        id: 'f10',
        title: "Waking Up Changed",
        body: "There's something that happens when you cry to Allah in the night that no daytime prayer replicates. I started tahajjud reluctantly, as a discipline. Now I can't imagine not having it. It is the most honest I am all day — just me, the dark, and my Creator. Everything else follows from that.",
        author: "Ismail B.",
        location: "Birmingham, UK",
        reactions: 23,
        tags: ["Spiritual"]
    },
    {
        id: 'f11',
        title: "When I Stopped Running",
        body: "I spent years running from Islam, from prayer, from accountability. One breakdown at 3am led me to make wudu — I don't know why. I prayed two rak'ahs. I felt seen in a way nothing else had given me. I haven't run since. Sometimes Allah meets you at your lowest.",
        author: "Anonymous",
        location: "New York, USA",
        reactions: 22,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'f12',
        title: "My Hardest Dua Was My Best Dua",
        body: "I had a dua I prayed for years that was never answered the way I wanted. I made it my tahajjud dua every single night. Years later I look back and see that Allah answered it — perfectly — just not how or when I expected. What I thought was silence was actually a story being written.",
        author: "Layla M.",
        location: "Chicago, USA",
        reactions: 11,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'f13',
        title: "Gratitude After Everything Was Taken",
        body: "I lost my business, my marriage, and my home in the same year. In what felt like ruins, I started praying tahajjud. I had nothing to pray for except gratitude for what was left — my health, my faith. That shift from asking to thanking changed everything. Within a year my life rebuilt itself.",
        author: "Mustafa G.",
        location: "Washington DC, USA",
        reactions: 26,
        tags: ["Spiritual", "Rizq"]
    },
    {
        id: 'f14',
        title: "Discovering Sujood",
        body: "I prayed for years without really understanding sujood. Then one night in tahajjud something clicked. You're literally putting your face on the floor. You can't go lower than that. And there's something about that — actually doing it, not just going through the motion — that hit me differently. I got up from that sujood feeling like I'd actually submitted for the first time. It's hard to explain but it was real.",
        author: "Omar H.",
        location: "Sydney, Australia",
        reactions: 11,
        tags: ["Spiritual"]
    },
    {
        id: 'f15',
        title: "The Night That Changed My Deen",
        body: "I was a Muslim in name only for most of my adult life. One night I couldn't sleep and on a whim I read about tahajjud. I tried it. That single night prayer cracked me open. Within a year I was praying all five, reading Quran daily, and fasting regularly. It started with two rak'ahs in the dark.",
        author: "Tariq A.",
        location: "London, UK",
        reactions: 16,
        tags: ["Spiritual", "Forgiveness"]
    },

    // ── Education / Success ─────────────────────────────────────────
    {
        id: '4',
        title: "The Impossible Exam",
        body: "I had a medical board exam that everyone said was impossible to pass on the first try. I studied hard, but I trusted Allah more. I prayed Tahajjud every night for a month. On exam day, I felt a strange calm. I passed with flying colors. Success comes from Him.",
        author: "Dr. A.",
        location: "Boston, USA",
        reactions: 42,
        tags: ["Education", "Success"]
    },
    {
        id: 'e2',
        title: "Oxford After Being Told No",
        body: "My school told me Oxford was unrealistic. I applied anyway, and for months prayed tahajjud asking Allah to open what He willed and close what He didn't. I got an offer. The academic who interviewed me said something about my composure stood out. I know what gave me that composure.",
        author: "Yusuf M.",
        location: "Bradford, UK",
        reactions: 23,
        tags: ["Education", "Success"]
    },
    {
        id: 'e3',
        title: "Passing Bar Exam on the Third Try",
        body: "I failed the bar exam twice. The shame was unbearable. Before my third attempt I committed to tahajjud for the entire study period. I also stopped studying after midnight and used that time for prayer instead. I passed. I believe the barakah in that decision gave me more than the extra hours of revision.",
        author: "Amirah S.",
        location: "Chicago, USA",
        reactions: 20,
        tags: ["Education", "Success"]
    },
    {
        id: 'e4',
        title: "First in My Family to Graduate",
        body: "I was the first in my family to go to university. The pressure was immense. I prayed tahajjud before every major exam, not asking for the answer but for the clarity to recall everything I had studied. Every single time I felt calm walking in. I graduated with a first. Barakah is real.",
        author: "Amara D.",
        location: "Atlanta, USA",
        reactions: 24,
        tags: ["Education", "Success"]
    },
    {
        id: 'e5',
        title: "PhD After Failing the Viva",
        body: "I failed my doctoral viva — the worst academic experience of my life. I had to revise and resubmit with no guarantee of passing again. I prayed tahajjud every night during revisions asking only for clarity and tawakkul. My second viva was the best academic conversation of my life. I passed with no corrections.",
        author: "Dr. Nadia F.",
        location: "Edinburgh, UK",
        reactions: 31,
        tags: ["Education", "Success"]
    },
    {
        id: 'e6',
        title: "The Teacher Who Changed My Life",
        body: "I was failing in school and losing hope. I prayed in tahajjud for guidance. Weeks later a new teacher joined our school who took a specific interest in me. She saw something I didn't see in myself. I went from nearly dropping out to top of my class. Allah sends people as answers to duas.",
        author: "Bilal O.",
        location: "Seattle, USA",
        reactions: 28,
        tags: ["Education"]
    },
    {
        id: 'e7',
        title: "The Award I Didn't Expect",
        body: "I had been working quietly for years without recognition. I wasn't doing it for awards but I was human — the lack of acknowledgement stung. I prayed tahajjud and asked only for sincerity, to work for Allah's pleasure alone. That year I received an industry award I hadn't submitted for. Recognition came when I stopped seeking it.",
        author: "Hana K.",
        location: "Dubai, UAE",
        reactions: 12,
        tags: ["Success", "Career"]
    },
    {
        id: 'e8',
        title: "Memorising Quran at 40",
        body: "I started trying to memorise Quran at 40. People said it was too late to start. I used tahajjud as revision time — reciting what I'd learned before sleeping and again after waking. It took me three years but I finished last Ramadan at 43. It wasn't easy and I'm not going to pretend it was. But it's done. There's no such thing as too late.",
        author: "Um Sulayman",
        location: "Cardiff, UK",
        reactions: 8,
        tags: ["Education", "Success", "Spiritual"]
    },
    {
        id: 'e9',
        title: "Learning Arabic to Understand My Prayer",
        body: "For years I prayed in Arabic without truly understanding. I started learning Arabic and using tahajjud as my practice time, reading the translation alongside. The moment the words started clicking was one of the most emotional experiences of my life. I had been saying 'Guide us to the straight path' for 20 years without truly hearing it.",
        author: "Kareem A.",
        location: "London, UK",
        reactions: 14,
        tags: ["Education", "Spiritual"]
    },
    {
        id: 'e10',
        title: "Raising a Hafiz",
        body: "My son is 15 and has completed hifz. I believe it started with my duas for him in tahajjud when he was still a baby — asking for a child whose heart would be filled with Allah's words. Every parent who prays for their child's akhirah is planting seeds they may not see bloom.",
        author: "Um Abdurrahman",
        location: "Chicago, USA",
        reactions: 13,
        tags: ["Education", "Family"]
    },
    {
        id: 'e11',
        title: "The Research Breakthrough",
        body: "I had been stuck on a research problem for eight months. My supervisor was losing patience. The night before a crucial meeting I prayed tahajjud and laid the problem before Allah. I woke up at 5am with a clarity I cannot explain. I had the solution. I genuinely believe Allah placed it in my mind.",
        author: "Dr. Rashid B.",
        location: "Toronto, Canada",
        reactions: 12,
        tags: ["Education", "Success"]
    },
    {
        id: 'e12',
        title: "Discipline That Changed Everything",
        body: "I was talented but undisciplined. Tahajjud taught me the first lesson of discipline — waking when your body says no because something greater calls. That same discipline started showing up in my studies, my work, my relationships. The night prayer is training for the rest of your life.",
        author: "Faris J.",
        location: "Dallas, USA",
        reactions: 37,
        tags: ["Success", "Spiritual"]
    },
    {
        id: 'e13',
        title: "Confidence to Speak Up",
        body: "I was terrified of public speaking. I had opportunities I couldn't take because of fear. I started making dua in tahajjud for the confidence that comes from knowing who sent you. Slowly the fear transformed. I recently gave a TEDx talk. The confidence I needed was never in myself — it was in the One behind me.",
        author: "Zahra N.",
        location: "Leicester, UK",
        reactions: 32,
        tags: ["Success", "Career"]
    },
    {
        id: 'e14',
        title: "When Quitting Was the Wrong Answer",
        body: "I was close to giving up on my studies. The programme was too hard and I felt out of my depth. I prayed tahajjud and asked for sabr. I also asked for a sign — stay or leave. Every sign said stay. I stayed. The hardest year became my most transformative. Tahajjud kept me in the room.",
        author: "Osman A.",
        location: "Minneapolis, USA",
        reactions: 14,
        tags: ["Education", "Success"]
    },
    {
        id: 'e15',
        title: "The Sports Career That Almost Didn't Happen",
        body: "I had a serious injury the year I was meant to go professional. I thought my career was over. I prayed tahajjud with everything I had, not asking to be great but asking for shifa and guidance. I recovered faster than expected, signed my contract, and have since attributed every goal to Allah. The pitch is my sujood.",
        author: "Hassan R.",
        location: "Glasgow, UK",
        reactions: 23,
        tags: ["Success", "Health"]
    },

    // ── Deep / Raw ──────────────────────────────────────────────────
    {
        id: 'd1',
        title: "The Worst Night of My Life Became the Best",
        body: "My wife had just told me she wanted a divorce. I sat on the bathroom floor at 2am and couldn't breathe. I don't know why I made wudu. I just did. I prayed two rak'ahs and completely broke down. Everything just came out. When I got up I felt different. Not better — different. We didn't end up saving the marriage. But whatever I found in that prayer mat that night, I wouldn't swap it.",
        author: "Anonymous",
        location: "Manchester, UK",
        reactions: 16,
        tags: ["Marriage", "Spiritual", "Forgiveness"]
    },
    {
        id: 'd2',
        title: "I Prayed Angry",
        body: "I want to be honest: I started tahajjud angry. Like properly angry at Allah. I felt I had done everything right and kept getting hit anyway. I stood and prayed but inside I was arguing the whole time. And somehow I still felt heard. Not like my problems got fixed. Just heard. I didn't know prayer could do that. I thought you had to come in humble. You don't.",
        author: "Anonymous",
        location: "Toronto, Canada",
        reactions: 35,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'd3',
        title: "Three Years of the Same Dua",
        body: "I made the same dua every single night for three years. Same words, same corner of my room, nothing changing. Then one Thursday in November it just happened. Exactly what I asked for. I cried for so long. Looking back now I think I genuinely wasn't ready before then. The wait wasn't wasted. I just couldn't see that at the time.",
        author: "Maryam H.",
        location: "London, UK",
        reactions: 18,
        tags: ["Spiritual", "Peace"]
    },
    {
        id: 'd4',
        title: "Suicidal at 3am, Muslim at 4am",
        body: "I will share this because someone needs it. I was planning to end my life. It was 3am. Something I cannot name stopped me and made me pray instead. Two rak'ahs. I cried so hard I couldn't make words. I just put my forehead on the floor and stayed there. I am here. Six years later, I am here. If you are in the dark right now — please pray before you decide anything.",
        author: "Anonymous",
        location: "USA",
        reactions: 13,
        tags: ["Anxiety", "Health", "Spiritual", "Forgiveness"]
    },
    {
        id: 'd5',
        title: "My Father Took His Shahada at 71",
        body: "My father was not Muslim. For years I made dua for him in tahajjud — not every night, I won't pretend — but consistently, for a long time. I never pushed him or argued. Last Ramadan, out of nowhere, he asked me what he needed to say to become Muslim. He took his shahada in our living room. I couldn't speak for about five minutes after. I don't know what changed in him. I just know I kept asking.",
        author: "Fatima R.",
        location: "Boston, USA",
        reactions: 13,
        tags: ["Family", "Spiritual"]
    },
    {
        id: 'd6',
        title: "The Letter I Never Expected to Write",
        body: "A man had wronged my family terribly. I hated him with everything I had for eight years. My sheikh told me to make dua for him in tahajjud — not for his forgiveness but for my own release from the hatred. I resisted for months. Eventually I tried. The first time I said his name in dua I physically shook. By the sixth week I was crying for him. I don't understand what happened. I only know I am free.",
        author: "Anonymous",
        location: "Sheffield, UK",
        reactions: 20,
        tags: ["Forgiveness", "Spiritual"]
    },
    {
        id: 'd7',
        title: "I Used to Fake My Prayers",
        body: "For years I prayed because my family watched me. Inside, I felt nothing — just going through motions I didn't believe in. I started tahajjud alone, before anyone woke, because I wanted to know if anything was real when no one was watching. The first night I felt nothing. The tenth night I wept for the first time in five years. By the fortieth night I stopped faking anything, in prayer or in life.",
        author: "Anonymous",
        location: "Birmingham, UK",
        reactions: 13,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'd8',
        title: "What the Night Taught Me About the Day",
        body: "I used to be reactive — every small problem would destabilise me. After a year of tahajjud I noticed something: I had become almost impossible to shake. Not because my problems got smaller but because I had spent hundreds of hours reminding myself who was actually in control. The night prayer isn't just worship. It is training. Every morning you enter the world differently because of what you did at 3am.",
        author: "Khalid M.",
        location: "Phoenix, USA",
        reactions: 21,
        tags: ["Spiritual", "Peace", "Anxiety"]
    },
    {
        id: 'd9',
        title: "I Found Out I Was Adopted",
        body: "I found out at 28 that my parents weren't my biological parents. I felt like the floor had disappeared. Couldn't talk to anyone about it, every conversation made it worse. Tahajjud was the only place I could take it. Night after night I just asked Allah who I am. And slowly it settled — not because I found my birth parents, but because I started to feel like my identity comes from Allah anyway. That's still what I hold onto.",
        author: "Anonymous",
        location: "Bristol, UK",
        reactions: 34,
        tags: ["Spiritual", "Family", "Peace"]
    },
    {
        id: 'd10',
        title: "When My Son Was Taken From Me",
        body: "I lost custody of my son in the divorce. Waking up at night to that absence was the hardest thing I've ever dealt with. I started praying tahajjud instead of just lying there. I kept it up for about two years. When he was old enough to have a say, he asked to come and live with me. I don't have an explanation for that. I'm just grateful.",
        author: "Anonymous",
        location: "Chicago, USA",
        reactions: 16,
        tags: ["Family", "Spiritual"]
    },
    {
        id: 'd11',
        title: "I Earned My First Halal Income at 34",
        body: "I had been in the haram industry for over a decade. I knew it was wrong but the money was too good and I told myself I'd change eventually. The 'eventually' came when I started tahajjud and couldn't make dua with a clear conscience. Something about standing before Allah at 3am stripped away every excuse. I quit. For six months I had almost nothing. Then a halal door opened that was better than anything I'd left. Barakah is not a metaphor.",
        author: "Anonymous",
        location: "Dubai, UAE",
        reactions: 12,
        tags: ["Career", "Rizq", "Spiritual", "Forgiveness"]
    },
    {
        id: 'd12',
        title: "The Miscarriage I Couldn't Grieve",
        body: "After my miscarriage I couldn't cry. I just felt completely numb, and then guilty for being numb. In tahajjud one night the grief finally hit me and I sobbed for what felt like an hour. But there was also this strange peace with it. I got this feeling that the baby was okay, that it was with Allah. I don't know where that came from. I just know it helped me more than anything else did.",
        author: "Anonymous",
        location: "Sydney, Australia",
        reactions: 44,
        tags: ["Family", "Health", "Spiritual"]
    },
    {
        id: 'd13',
        title: "I Stopped Running From Accountability",
        body: "Tahajjud made me face myself. Just me and Allah at 3am with nowhere to hide. I started seeing clearly how much I'd been avoiding — people I owed apologies to, same mistakes on repeat, hurt I'd caused and brushed off. I didn't become a better person through a book or a programme. I became one by having to stand in front of Allah every night knowing He already knew what I was doing.",
        author: "Tariq S.",
        location: "Perth, Australia",
        reactions: 19,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'd14',
        title: "Both My Parents Were Ill at the Same Time",
        body: "My mother had cancer and my father had a stroke within the same month. I was their only child. I was terrified, exhausted, and completely alone in managing it all. Tahajjud was the only hour that was mine — where I could put it all down and just be a child asking for help. Both of them survived. But more than that: those months of night prayer forged something in me that I carry everywhere.",
        author: "Samira A.",
        location: "Indianapolis, USA",
        reactions: 9,
        tags: ["Family", "Health", "Spiritual"]
    },
    {
        id: 'd15',
        title: "I Cried for the First Time in 11 Years",
        body: "I was raised to believe men don't cry. I hadn't cried since I was a teenager. Twelve years of suppressed grief, loss, and fear. In my first tahajjud, something in the words of Al-Fatiha — 'Guide us to the straight path' — broke through it. I wept for an hour and a half on my prayer mat. My wife found me there. She said she had been praying that my heart would soften for years. Allah answered her dua through mine.",
        author: "Anonymous",
        location: "Columbus, USA",
        reactions: 8,
        tags: ["Spiritual", "Forgiveness", "Marriage"]
    },
    {
        id: 'd16',
        title: "Gaza Was My Wake-Up Call",
        body: "What was happening in Gaza was breaking me. I felt useless sitting here with everything I have. A friend told me — if you can't be there, then wake up at night and beg the One who controls everything. So I did. I started calling out names of people I'd never met from places I'd never been. Something about doing that — sitting in the dark praying for people going through something I can't even imagine — completely changed how I feel about the ummah.",
        author: "Anonymous",
        location: "London, UK",
        reactions: 10,
        tags: ["Spiritual", "Peace"]
    },
    {
        id: 'd17',
        title: "The Moment I Understood Tawakkul",
        body: "I had planned every detail of my life — career, timeline, milestones. And then everything collapsed at once, on schedule for nothing I had set. In tahajjud I finally surrendered. Not as defeat but as genuine release. I said: You plan, I'll move. Within a year my life looked nothing like my plan and everything like something better. Tawakkul is not passive. It is the most active thing I have ever done.",
        author: "Noor A.",
        location: "Denver, USA",
        reactions: 22,
        tags: ["Spiritual", "Peace", "Rizq"]
    },
    {
        id: 'd18',
        title: "Forty Nights Before My Wedding",
        body: "I committed to forty consecutive nights of tahajjud in the month before my nikah. I asked Allah to make our marriage a mercy, a sakinah, a partnership in this dunya and the next. It is four years later. We have had hardships — of course — but something about that intention set before we even began has been a foundation we return to in every difficulty. Start as you mean to go on.",
        author: "Hana and Yusuf",
        location: "Baltimore, USA",
        reactions: 28,
        tags: ["Marriage", "Spiritual"]
    },
    {
        id: 'd19',
        title: "My Darkest Ramadan",
        body: "I fasted but felt nothing that Ramadan. No connection, no khushoo, no change. I was spiritually empty and I knew it. On the 27th night I forced myself to stand in tahajjud even though I expected nothing. An ayah hit me differently than it ever had — 'And He found you lost and guided you.' I sat with that for an hour. I had been waiting for the feeling of Ramadan. Allah had been waiting for me to admit I was lost.",
        author: "Ibrahim K.",
        location: "Philadelphia, USA",
        reactions: 17,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'd20',
        title: "What My Grandmother Left Me",
        body: "My grandmother died with a prayer mat so worn it was almost see-through. As far back as anyone in the family can remember, she prayed tahajjud most nights. She never had much money and her life wasn't easy. But there was something about her — people who knew her always mentioned it. A kind of calm. I used to wish her life had been easier. Now I'm not so sure she was missing anything.",
        author: "Layla K.",
        location: "Liverpool, UK",
        reactions: 9,
        tags: ["Spiritual", "Peace", "Family"]
    },
];

export const storyTopics = ["All", "Career", "Marriage", "Anxiety", "Health", "Forgiveness", "Spiritual", "Education", "Success", "Family", "Peace", "Rizq"];
