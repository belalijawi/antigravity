export interface Testimony {
    id: string;
    title: string;
    body: string;
    author: string;
    location: string;
    reactions: number;
    tags: string[];
}

export const initialTestimonies: Testimony[] = [
    // ── Career / Rizq ──────────────────────────────────────────────
    {
        id: '1',
        title: "The Job I Prayed For",
        body: "I was unemployed for 2 years. Rejections piled up, and I felt worthless. Then I started waking up 20 minutes before Fajr. I poured my heart out in Sujood. Two weeks later, I got a call for a job that was better than anything I applied for. Tahajjud opened doors that were sealed shut.",
        author: "Anonymous",
        location: "London, UK",
        reactions: 124,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c2',
        title: "From Debt to Abundance",
        body: "Our family was buried in debt and I couldn't see a way out. A friend told me about the power of Tahajjud for rizq. I committed for 40 nights straight. By the 30th night, an old client called out of nowhere with a project that cleared everything. I still cannot explain it except through Allah's mercy.",
        author: "Tariq M.",
        location: "Karachi, Pakistan",
        reactions: 97,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c3',
        title: "Promotion After 5 Years",
        body: "I was passed over for promotion three times. I started praying Tahajjud and asking for either the promotion or something better. Within six months I was promoted AND given a team to lead. What years of hard work couldn't achieve, two rak'ahs in the night accomplished.",
        author: "Fatimah A.",
        location: "Toronto, Canada",
        reactions: 83,
        tags: ["Career"]
    },
    {
        id: 'c4',
        title: "The Business That Survived",
        body: "COVID nearly destroyed my small restaurant. I was this close to closing. I started tahajjud, crying over my business every night. A grant appeared that I didn't apply for, then a viral post, then a catering contract. My restaurant is now thriving. Rizq comes in unexpected ways.",
        author: "Ibrahim O.",
        location: "Manchester, UK",
        reactions: 119,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c5',
        title: "Visa Approved After 3 Rejections",
        body: "My student visa was rejected three times. I had given up hope. My mother made me promise to pray Tahajjud for 7 nights. On the 4th application, the officer who interviewed me was different. He approved it on the spot. My mother knew something I didn't.",
        author: "Amira N.",
        location: "Lagos, Nigeria",
        reactions: 76,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c6',
        title: "A Salary I Never Expected",
        body: "I was about to accept a low-paying job out of desperation. The night before I was going to sign, I prayed Tahajjud and asked Allah to guide me. The next morning, I got a completely unexpected email from a company offering double the salary. I almost missed my rizq by one night.",
        author: "Yusuf K.",
        location: "Nairobi, Kenya",
        reactions: 68,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c7',
        title: "Starting My Own Business",
        body: "I had an idea but no courage. For months I prayed Tahajjud asking Allah for a sign. A mentor appeared out of nowhere, offered to invest, and told me to 'just start.' That was three years ago. Alhamdulillah, my business now employs 12 people.",
        author: "Maryam B.",
        location: "Casablanca, Morocco",
        reactions: 91,
        tags: ["Career"]
    },
    {
        id: 'c8',
        title: "Published After Years of Rejection",
        body: "Every publisher rejected my manuscript. I prayed Tahajjud for months asking Allah to make a way. An agent found me on Twitter, loved my book, and within a year it was published. The night prayer never goes unanswered — the answer just comes in Allah's timing.",
        author: "Zainab H.",
        location: "Cairo, Egypt",
        reactions: 105,
        tags: ["Career", "Success"]
    },
    {
        id: 'c9',
        title: "Saved From a Bad Contract",
        body: "I was about to sign a business deal that looked good on paper. Something made me pray Tahajjud that night. In the morning I felt strongly not to sign. Two weeks later, the company went bankrupt and everyone who signed lost everything. Tahajjud protected me from what I couldn't see.",
        author: "Bilal S.",
        location: "Dubai, UAE",
        reactions: 88,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c10',
        title: "Found My Calling in the Night Hours",
        body: "I hated my job for years but didn't know what else to do. In the quiet of Tahajjud I finally listened to what my heart was saying. I retrained, changed careers, and now wake up excited to work. The direction I needed was always there — I just needed the silence of the night to hear it.",
        author: "Hana R.",
        location: "Berlin, Germany",
        reactions: 72,
        tags: ["Career"]
    },
    {
        id: 'c11',
        title: "A Scholarship From Nowhere",
        body: "My family couldn't afford university. I prayed every night of Ramadan and throughout the year in Tahajjud. A full scholarship for my dream university arrived — one I hadn't even applied to because I thought it was out of reach. Allah's resources have no limit.",
        author: "Omar F.",
        location: "Accra, Ghana",
        reactions: 143,
        tags: ["Career", "Education"]
    },
    {
        id: 'c12',
        title: "The Freelance Career That Took Off",
        body: "I left a secure job to freelance and for months had almost no clients. I started waking at 3am not out of discipline but desperation. Within weeks, referrals started flooding in. Today I earn more than I ever did. I believe those late-night duas were the turning point.",
        author: "Nadia P.",
        location: "Kuala Lumpur, Malaysia",
        reactions: 64,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c13',
        title: "Lost My Job, Found My Purpose",
        body: "Being made redundant felt like a disaster. I started praying Tahajjud out of grief. Slowly I realised it was the push I needed. I launched the non-profit I'd been dreaming about. Today we've helped over 500 families. What looked like a loss was the best thing Allah ever gave me.",
        author: "Khalid J.",
        location: "Birmingham, UK",
        reactions: 157,
        tags: ["Career", "Rizq"]
    },
    {
        id: 'c14',
        title: "Negotiated My Worth",
        body: "I was underpaid for years, too scared to negotiate. After months of Tahajjud I felt a quiet confidence I'd never had before. I walked into my boss's office and asked for what I deserved. He said yes without hesitation. Sometimes rizq is behind a conversation you've been afraid to have.",
        author: "Safia L.",
        location: "Amsterdam, Netherlands",
        reactions: 55,
        tags: ["Career"]
    },
    {
        id: 'c15',
        title: "Business Partner Sent by Allah",
        body: "I was struggling to grow my business alone. I made specific dua in tahajjud for a trustworthy partner. Six months later, at an event I almost didn't attend, I met the person who changed everything. We've been partners for four years and our business has tripled. Allah answers specific prayers specifically.",
        author: "Faris T.",
        location: "Istanbul, Turkey",
        reactions: 79,
        tags: ["Career", "Rizq"]
    },

    // ── Marriage / Family ───────────────────────────────────────────
    {
        id: '3',
        title: "A Broken Marriage Restored",
        body: "We were on the brink of divorce. Arguments every day. I started praying Tahajjud specifically for our hearts to soften. Slowly, the anger faded. We started communicating again. It's been a year, and we are happier than ever. Allah turns hearts.",
        author: "Anonymous",
        location: "Dubai, UAE",
        reactions: 156,
        tags: ["Marriage", "Family"]
    },
    {
        id: 'm2',
        title: "My Child Came Home",
        body: "My son had been estranged for 3 years. I cried over him in every Tahajjud for months. One ordinary Tuesday morning he called and said he wanted to come home. I don't know what changed in his heart but I know what changed in mine — and I believe Allah linked them.",
        author: "Um Khalid",
        location: "Amman, Jordan",
        reactions: 201,
        tags: ["Family"]
    },
    {
        id: 'm3',
        title: "Finding the Right Spouse",
        body: "I was 35 and had almost given up on marriage. I made a very specific dua in tahajjud — describing the qualities I needed, not just wanted. Eight months later I met someone who matched every point. We got married last spring. Never stop being specific with Allah.",
        author: "Nour A.",
        location: "London, UK",
        reactions: 134,
        tags: ["Marriage"]
    },
    {
        id: 'm4',
        title: "Infertility and a Miracle",
        body: "After 6 years of trying, 3 rounds of IVF, and countless heartbreaks, I began Tahajjud with a desperation I'd never felt before. I stopped asking 'why me' and just asked Allah for His mercy. Our daughter was born eight months later. Some gifts come only when we've exhausted every other door.",
        author: "Anonymous",
        location: "Sydney, Australia",
        reactions: 289,
        tags: ["Family", "Health"]
    },
    {
        id: 'm5',
        title: "My Parents Reconciled",
        body: "My parents separated when I was a teenager and hadn't spoken in years. I prayed tahajjud for their reconciliation. They've since remarried each other. I genuinely did not think this was possible. With Allah, nothing is impossible.",
        author: "Hamza R.",
        location: "Paris, France",
        reactions: 177,
        tags: ["Marriage", "Family"]
    },
    {
        id: 'm6',
        title: "A Difficult Mother-in-Law",
        body: "My relationship with my mother-in-law was poisoning my marriage. Instead of complaining, I started making dua for her in Tahajjud — genuinely asking Allah to bless her. Something shifted. She called me one day to apologise unprompted. That call changed everything.",
        author: "Leila M.",
        location: "Brussels, Belgium",
        reactions: 112,
        tags: ["Marriage", "Family"]
    },
    {
        id: 'm7',
        title: "Healing After Betrayal",
        body: "I found out my spouse had been lying to me for years. I was shattered. I didn't know if I could forgive or continue. Tahajjud became my rebuilding. Slowly, I found the strength not just to decide what to do but to be at peace with it. Allah alone heals what people break.",
        author: "Anonymous",
        location: "USA",
        reactions: 195,
        tags: ["Marriage", "Forgiveness"]
    },
    {
        id: 'm8',
        title: "Reconnecting With My Father",
        body: "My father and I hadn't spoken properly in a decade. I started praying for him specifically in tahajjud. Six months later, he called me out of nowhere, voice full of emotion, asking if we could start fresh. He told me he'd been feeling a pull toward reconciliation for months. SubhanAllah.",
        author: "Saud K.",
        location: "Riyadh, Saudi Arabia",
        reactions: 146,
        tags: ["Family"]
    },
    {
        id: 'm9',
        title: "The Wedding That Almost Didn't Happen",
        body: "Our families were opposed to our marriage and we had a deadline to make a decision. I prayed two rak'ahs of Tahajjud and placed the matter completely in Allah's hands. The next morning, both fathers called each of us and agreed. It was like Allah arranged the whole thing overnight.",
        author: "Aya and Mostafa",
        location: "Cairo, Egypt",
        reactions: 168,
        tags: ["Marriage"]
    },
    {
        id: 'm10',
        title: "Patience With a Struggling Sibling",
        body: "My brother's addiction was tearing our family apart. I made dua for him every night in tahajjud — not to change him, but for Allah to guide him. He entered rehab last year without any pressure from us. He said one morning he just 'woke up and knew.' I know why.",
        author: "Anonymous",
        location: "Toronto, Canada",
        reactions: 122,
        tags: ["Family"]
    },
    {
        id: 'm11',
        title: "The Rift With My Sister Healed",
        body: "My sister and I had a falling out over inheritance and didn't speak for two years. I started making dua for her in tahajjud, asking Allah to remove the bitterness from my heart first. One day I woke up and simply had no more resentment. I called her. She was waiting for me to call.",
        author: "Layla F.",
        location: "Melbourne, Australia",
        reactions: 88,
        tags: ["Family", "Forgiveness"]
    },
    {
        id: 'm12',
        title: "My Son Returned to the Deen",
        body: "My teenage son stopped praying and I feared losing him completely. Rather than lecture him more, I started praying for him in Tahajjud every night. One Ramadan he stood up to pray without me asking. He's now more religious than I was at his age. Dua does what words cannot.",
        author: "Um Ibrahim",
        location: "Jakarta, Indonesia",
        reactions: 214,
        tags: ["Family"]
    },
    {
        id: 'm13',
        title: "A Marriage That Became a Partnership",
        body: "My husband and I had grown apart. We were two people living parallel lives. I prayed tahajjud specifically for our connection to deepen. He started joining me for Fajr. Then we started talking. Now we have weekly date nights and I feel more in love than when we married.",
        author: "Mariam Z.",
        location: "Houston, USA",
        reactions: 103,
        tags: ["Marriage"]
    },
    {
        id: 'm14',
        title: "Praying Together Changed Us",
        body: "I asked my husband to try tahajjud together for 30 nights as a challenge. We've been doing it for two years now. The 3am conversations after prayer have become the most important conversations of our marriage. We say things in the dark we could never say in the daylight.",
        author: "Hana and Rami",
        location: "Beirut, Lebanon",
        reactions: 138,
        tags: ["Marriage"]
    },
    {
        id: 'm15',
        title: "For a Righteous Child",
        body: "When I was pregnant I spent my tahajjud time making dua for my unborn child to be a gift to the ummah. My daughter is now 12 and has memorised 15 juz. Every parent's greatest gift to their child is the duas made before they even understand what dua means.",
        author: "Um Abdullah",
        location: "Madinah, Saudi Arabia",
        reactions: 261,
        tags: ["Family"]
    },

    // ── Anxiety / Health ────────────────────────────────────────────
    {
        id: '2',
        title: "Peace in the Chaos",
        body: "My anxiety was crippling. I couldn't sleep. One night, instead of tossing and turning, I made wudu and prayed. The silence of the night combined with the words of Allah healed something in me. Now, Tahajjud is my therapy. The anxiety is gone, replaced by a peace I can't explain.",
        author: "Sarah K.",
        location: "Toronto, Canada",
        reactions: 98,
        tags: ["Anxiety", "Health", "Peace"]
    },
    {
        id: 'h2',
        title: "The Panic Attacks Stopped",
        body: "I had panic attacks for three years. Medication helped but never fully solved it. A therapist suggested adding spiritual practice. I started tahajjud. After two months the panic attacks became rare. After six months they were gone. I'm not saying it was only this — but I know it was the missing piece.",
        author: "Rashid M.",
        location: "New York, USA",
        reactions: 87,
        tags: ["Anxiety", "Health"]
    },
    {
        id: 'h3',
        title: "Depression Lifted at 3am",
        body: "Clinical depression had taken everything from me. I couldn't work, couldn't function. In my darkest hour I dragged myself to pray Tahajjud, not because I believed it would help, but because I had nothing left to lose. Slowly, something began to shift. A year later I am a different person.",
        author: "Anonymous",
        location: "Birmingham, UK",
        reactions: 176,
        tags: ["Anxiety", "Health", "Peace"]
    },
    {
        id: 'h4',
        title: "Cancer, Chemo, and Calm",
        body: "During chemotherapy I had every reason to fall apart. But my tahajjud became my anchor. I'd wake at 3am, weak and nauseous, and somehow in those moments of connection with Allah I found a peace that my doctors couldn't explain. I'm in remission now and I believe prayer was part of my medicine.",
        author: "Aisha T.",
        location: "Cape Town, South Africa",
        reactions: 243,
        tags: ["Health"]
    },
    {
        id: 'h5',
        title: "Insomnia Became Ibadah",
        body: "I couldn't sleep for years. Doctors tried everything. Then I decided to use my wakeful hours for tahajjud. The insomnia didn't disappear immediately but the dread of it did. Eventually my sleep regulated. What I once cursed became the best part of my life.",
        author: "Huda N.",
        location: "Amsterdam, Netherlands",
        reactions: 69,
        tags: ["Health", "Peace"]
    },
    {
        id: 'h6',
        title: "A Chronic Illness and Patience",
        body: "I have a chronic condition that will never fully go away. I used to rage against it. Tahajjud taught me to accept it. To still be grateful. To find the barakah in limitations. I am not healed, but I am at peace — and that is a different kind of miracle.",
        author: "Anonymous",
        location: "Copenhagen, Denmark",
        reactions: 92,
        tags: ["Health", "Peace"]
    },
    {
        id: 'h7',
        title: "Before the Surgery",
        body: "The night before a risky surgery I was terrified. I prayed tahajjud and asked Allah to guide my surgeon's hands. The surgery went better than expected. My surgeon said it was one of the cleanest procedures he'd performed. I believe Allah guided those hands.",
        author: "Abdullah S.",
        location: "Jeddah, Saudi Arabia",
        reactions: 134,
        tags: ["Health"]
    },
    {
        id: 'h8',
        title: "Mental Clarity I Couldn't Buy",
        body: "Years of stress had left me mentally foggy. I couldn't focus, make decisions, or think clearly. After 3 months of consistent tahajjud my mind cleared. I don't know the mechanism — I just know that the morning after tahajjud I think differently. Clearer, calmer, sharper.",
        author: "Khalil A.",
        location: "Montreal, Canada",
        reactions: 78,
        tags: ["Anxiety", "Health"]
    },
    {
        id: 'h9',
        title: "My Brother's Recovery",
        body: "My brother was in a coma after an accident. Doctors gave him a 20% chance. We prayed tahajjud as a family in the hospital corridor every night. He woke up after 11 days. His neurosurgeon called it medically inexplicable. We knew exactly what had happened.",
        author: "Yasmine A.",
        location: "Paris, France",
        reactions: 298,
        tags: ["Health", "Family"]
    },
    {
        id: 'h10',
        title: "When Grief Became Gratitude",
        body: "I lost my mother suddenly. Grief was consuming me. In the middle of the night I would wake up and just cry in sujood. Over months, those tears slowly changed. The sadness didn't disappear but it transformed into gratitude for the years I had with her. Tahajjud didn't erase my grief — it alchemised it.",
        author: "Ismail O.",
        location: "Lagos, Nigeria",
        reactions: 167,
        tags: ["Anxiety", "Peace", "Family"]
    },
    {
        id: 'h11',
        title: "Fear of the Future Gone",
        body: "I was paralysed by anxiety about the future — finances, health, relationships. I'd wake at 3am gripped by fear. Then I started channelling those hours into tahajjud instead of worry. Slowly the fear lost its power. I realised that if I'm talking to the One who controls the future, what exactly am I afraid of?",
        author: "Safiya B.",
        location: "Nairobi, Kenya",
        reactions: 121,
        tags: ["Anxiety", "Peace"]
    },
    {
        id: 'h12',
        title: "Fertility After Being Told No",
        body: "Doctors said IVF was our only hope. We couldn't afford it. I spent six months in tahajjud begging Allah. My wife fell pregnant naturally. The doctor was shocked. We named our son Yahya after the prophet who was born to parents told conception was impossible. Some doors open from the inside.",
        author: "Musa K.",
        location: "Kuala Lumpur, Malaysia",
        reactions: 187,
        tags: ["Health", "Family"]
    },
    {
        id: 'h13',
        title: "The Addiction I Couldn't Break",
        body: "I had a private addiction I was ashamed to tell anyone. I tried to stop alone for years. One night in desperation I prayed tahajjud and was completely honest with Allah about everything. That was the turning point. No programme, no counsellor — just total honesty in the dark and a mercy that I did not deserve.",
        author: "Anonymous",
        location: "USA",
        reactions: 144,
        tags: ["Health", "Forgiveness"]
    },
    {
        id: 'h14',
        title: "Night Prayers Replaced Night Scrolling",
        body: "I was addicted to my phone at night. Sleep deprivation was destroying my health. Replacing late night scrolling with tahajjud was the best trade I ever made. My sleep improved, my focus returned, my anxiety reduced. Sometimes healing is simply replacing one habit with another.",
        author: "Nadia R.",
        location: "Stockholm, Sweden",
        reactions: 73,
        tags: ["Anxiety", "Health"]
    },
    {
        id: 'h15',
        title: "Healing From a Toxic Relationship",
        body: "Leaving an abusive relationship left me broken. I didn't trust myself or anyone else. Tahajjud became my rebuilding. In those quiet hours I talked to Allah about things I couldn't say aloud. Slowly I began to heal. Two years on, I am strong, whole, and grateful for the journey.",
        author: "Anonymous",
        location: "Manchester, UK",
        reactions: 159,
        tags: ["Anxiety", "Health", "Forgiveness"]
    },

    // ── Forgiveness / Spiritual ─────────────────────────────────────
    {
        id: '5',
        title: "Forgiving Myself",
        body: "I carried guilt for years over past mistakes. I felt too ashamed to ask for forgiveness. But in the quiet of the night, I realized Allah's mercy is bigger than my sins. Crying in Tahajjud washed away the guilt. I finally feel free.",
        author: "Anonymous",
        location: "USA",
        reactions: 112,
        tags: ["Forgiveness", "Spiritual"]
    },
    {
        id: 'f2',
        title: "Returning After Years Away",
        body: "I had left Islam in my late teens. For years I felt lost. In my 30s, at my lowest point, I remembered a Tahajjud my grandmother used to pray. I tried it. In that prayer, I felt something I hadn't felt in 15 years — that I was known, heard, and loved. I never left again.",
        author: "Anonymous",
        location: "London, UK",
        reactions: 224,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'f3',
        title: "Forgiving the Unforgivable",
        body: "Someone wronged me deeply. I carried hatred for years. A scholar told me that carrying resentment only harms the one carrying it, and that dua for your enemy in tahajjud is among the most powerful acts. I forced myself to make dua for them. My hatred dissolved. My heart was the one that was freed.",
        author: "Anonymous",
        location: "Doha, Qatar",
        reactions: 156,
        tags: ["Forgiveness", "Spiritual"]
    },
    {
        id: 'f4',
        title: "The Night I Almost Gave Up on Allah",
        body: "I don't say this lightly — I was on the verge of losing my faith. I prayed one last prayer in the dark, half-accusing, half-pleading. Something in that prayer broke open. I felt a presence I cannot describe. I wept for an hour. I've never doubted since. Sometimes the darkest dua is the most powerful.",
        author: "Anonymous",
        location: "Malaysia",
        reactions: 198,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'f5',
        title: "When Khushoo Finally Came",
        body: "For years I prayed but felt nothing. My salah was mechanical. I started doing tahajjud and something about the silence and darkness changed everything. Tears came for the first time. I felt the words of the Quran for the first time. The khushoo I had been chasing for years arrived when I stopped chasing it.",
        author: "Hamid L.",
        location: "Paris, France",
        reactions: 147,
        tags: ["Spiritual"]
    },
    {
        id: 'f6',
        title: "Reconciling With God After Loss",
        body: "I was angry at Allah after losing my child. I won't pretend I wasn't. But I came back to prayer because I had nowhere else to take my grief. In the silence of Tahajjud I told Allah exactly how I felt. And somehow, in that honesty, healing began. He can handle our anger. He just wants us to come.",
        author: "Anonymous",
        location: "Toronto, Canada",
        reactions: 234,
        tags: ["Spiritual", "Forgiveness", "Family"]
    },
    {
        id: 'f7',
        title: "Letting Go of Envy",
        body: "I was consumed by envy of others' success. I hated that about myself. I started making dua in tahajjud for the people I envied — genuinely asking for blessings for them. The envy evaporated. I realised envy had been blocking my own blessings. Dua for others is really dua for yourself.",
        author: "Sana M.",
        location: "Riyadh, Saudi Arabia",
        reactions: 89,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'f8',
        title: "Reading Quran With New Eyes",
        body: "I had read Quran my whole life without it truly affecting me. After starting tahajjud regularly, I opened the Mushaf one morning and every ayah seemed to speak directly to my situation. I cried through three surahs. The book hadn't changed — I had.",
        author: "Yusra A.",
        location: "Tunis, Tunisia",
        reactions: 103,
        tags: ["Spiritual"]
    },
    {
        id: 'f9',
        title: "The Peace That Doesn't Make Sense",
        body: "Everything in my life was objectively difficult. But I had the most profound peace. Colleagues would ask how I stayed so calm. My only answer was the night prayer. There is a peace that Allah gives in response to Tahajjud that has no rational explanation. I stop trying to explain it and just receive it.",
        author: "Amira K.",
        location: "Stockholm, Sweden",
        reactions: 118,
        tags: ["Spiritual", "Peace"]
    },
    {
        id: 'f10',
        title: "Waking Up Changed",
        body: "There's something that happens when you cry to Allah in the night that no daytime prayer replicates. I started tahajjud reluctantly, as a discipline. Now I can't imagine not having it. It is the most honest I am all day — just me, the dark, and my Creator. Everything else follows from that.",
        author: "Ismail B.",
        location: "Birmingham, UK",
        reactions: 95,
        tags: ["Spiritual"]
    },
    {
        id: 'f11',
        title: "When I Stopped Running",
        body: "I spent years running from Islam, from prayer, from accountability. One breakdown at 3am led me to make wudu — I don't know why. I prayed two rak'ahs. I felt seen in a way nothing else had given me. I haven't run since. Sometimes Allah meets you at your lowest.",
        author: "Anonymous",
        location: "New York, USA",
        reactions: 172,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'f12',
        title: "My Hardest Dua Was My Best Dua",
        body: "I had a dua I prayed for years that was never answered the way I wanted. I made it my tahajjud dua every single night. Years later I look back and see that Allah answered it — perfectly — just not how or when I expected. What I thought was silence was actually a story being written.",
        author: "Layla M.",
        location: "Cairo, Egypt",
        reactions: 207,
        tags: ["Spiritual", "Forgiveness"]
    },
    {
        id: 'f13',
        title: "Gratitude After Everything Was Taken",
        body: "I lost my business, my marriage, and my home in the same year. In what felt like ruins, I started praying tahajjud. I had nothing to pray for except gratitude for what was left — my health, my faith. That shift from asking to thanking changed everything. Within a year my life rebuilt itself.",
        author: "Mustafa G.",
        location: "Istanbul, Turkey",
        reactions: 191,
        tags: ["Spiritual", "Rizq"]
    },
    {
        id: 'f14',
        title: "Discovering Sujood",
        body: "I never understood why Muslims put their face to the ground until I truly submitted in sujood. Something about the physical act of prostration — the most vulnerable position a human body can take — opened something in me spiritually. I stopped thinking of it as ritual and started experiencing it as truth.",
        author: "Omar H.",
        location: "Jakarta, Indonesia",
        reactions: 84,
        tags: ["Spiritual"]
    },
    {
        id: 'f15',
        title: "The Night That Changed My Deen",
        body: "I was a Muslim in name only for most of my adult life. One night I couldn't sleep and on a whim I read about tahajjud. I tried it. That single night prayer cracked me open. Within a year I was praying all five, reading Quran daily, and fasting regularly. It started with two rak'ahs in the dark.",
        author: "Tariq A.",
        location: "London, UK",
        reactions: 263,
        tags: ["Spiritual", "Forgiveness"]
    },

    // ── Education / Success ─────────────────────────────────────────
    {
        id: '4',
        title: "The Impossible Exam",
        body: "I had a medical board exam that everyone said was impossible to pass on the first try. I studied hard, but I trusted Allah more. I prayed Tahajjud every night for a month. On exam day, I felt a strange calm. I passed with flying colors. Success comes from Him.",
        author: "Dr. A.",
        location: "Cairo, Egypt",
        reactions: 87,
        tags: ["Education", "Success"]
    },
    {
        id: 'e2',
        title: "Oxford After Being Told No",
        body: "My school told me Oxford was unrealistic. I applied anyway, and for months prayed tahajjud asking Allah to open what He willed and close what He didn't. I got an offer. The academic who interviewed me said something about my composure stood out. I know what gave me that composure.",
        author: "Yusuf M.",
        location: "Bradford, UK",
        reactions: 119,
        tags: ["Education", "Success"]
    },
    {
        id: 'e3',
        title: "Passing Bar Exam on the Third Try",
        body: "I failed the bar exam twice. The shame was unbearable. Before my third attempt I committed to tahajjud for the entire study period. I also stopped studying after midnight and used that time for prayer instead. I passed. I believe the barakah in that decision gave me more than the extra hours of revision.",
        author: "Amirah S.",
        location: "Chicago, USA",
        reactions: 93,
        tags: ["Education", "Success"]
    },
    {
        id: 'e4',
        title: "First in My Family to Graduate",
        body: "I was the first in my family to go to university. The pressure was immense. I prayed tahajjud before every major exam, not asking for the answer but for the clarity to recall everything I had studied. Every single time I felt calm walking in. I graduated with a first. Barakah is real.",
        author: "Amara D.",
        location: "Paris, France",
        reactions: 101,
        tags: ["Education", "Success"]
    },
    {
        id: 'e5',
        title: "PhD After Failing the Viva",
        body: "I failed my doctoral viva — the worst academic experience of my life. I had to revise and resubmit with no guarantee of passing again. I prayed tahajjud every night during revisions asking only for clarity and tawakkul. My second viva was the best academic conversation of my life. I passed with no corrections.",
        author: "Dr. Nadia F.",
        location: "Edinburgh, UK",
        reactions: 77,
        tags: ["Education", "Success"]
    },
    {
        id: 'e6',
        title: "The Teacher Who Changed My Life",
        body: "I was failing in school and losing hope. I prayed in tahajjud for guidance. Weeks later a new teacher joined our school who took a specific interest in me. She saw something I didn't see in myself. I went from nearly dropping out to top of my class. Allah sends people as answers to duas.",
        author: "Bilal O.",
        location: "Nairobi, Kenya",
        reactions: 68,
        tags: ["Education"]
    },
    {
        id: 'e7',
        title: "The Award I Didn't Expect",
        body: "I had been working quietly for years without recognition. I wasn't doing it for awards but I was human — the lack of acknowledgement stung. I prayed tahajjud and asked only for sincerity, to work for Allah's pleasure alone. That year I received an industry award I hadn't submitted for. Recognition came when I stopped seeking it.",
        author: "Hana K.",
        location: "Dubai, UAE",
        reactions: 82,
        tags: ["Success", "Career"]
    },
    {
        id: 'e8',
        title: "Memorising Quran at 40",
        body: "I started memorising Quran at 40, something many said was too late. Tahajjud became my revision time. Using this app for hifz and reciting before sleeping and after waking up — I completed my memorisation last Ramadan at age 43. There is no 'too late' with Allah.",
        author: "Um Sulayman",
        location: "Casablanca, Morocco",
        reactions: 312,
        tags: ["Education", "Success", "Spiritual"]
    },
    {
        id: 'e9',
        title: "Learning Arabic to Understand My Prayer",
        body: "For years I prayed in Arabic without truly understanding. I started learning Arabic and using tahajjud as my practice time, reading the translation alongside. The moment the words started clicking was one of the most emotional experiences of my life. I had been saying 'Guide us to the straight path' for 20 years without truly hearing it.",
        author: "Kareem A.",
        location: "London, UK",
        reactions: 145,
        tags: ["Education", "Spiritual"]
    },
    {
        id: 'e10',
        title: "Raising a Hafiz",
        body: "My son is 15 and has completed hifz. I believe it started with my duas for him in tahajjud when he was still a baby — asking for a child whose heart would be filled with Allah's words. Every parent who prays for their child's akhirah is planting seeds they may not see bloom.",
        author: "Um Abdurrahman",
        location: "Madinah, Saudi Arabia",
        reactions: 189,
        tags: ["Education", "Family"]
    },
    {
        id: 'e11',
        title: "The Research Breakthrough",
        body: "I had been stuck on a research problem for eight months. My supervisor was losing patience. The night before a crucial meeting I prayed tahajjud and laid the problem before Allah. I woke up at 5am with a clarity I cannot explain. I had the solution. I genuinely believe Allah placed it in my mind.",
        author: "Dr. Rashid B.",
        location: "Toronto, Canada",
        reactions: 94,
        tags: ["Education", "Success"]
    },
    {
        id: 'e12',
        title: "Discipline That Changed Everything",
        body: "I was talented but undisciplined. Tahajjud taught me the first lesson of discipline — waking when your body says no because something greater calls. That same discipline started showing up in my studies, my work, my relationships. The night prayer is training for the rest of your life.",
        author: "Faris J.",
        location: "Istanbul, Turkey",
        reactions: 107,
        tags: ["Success", "Spiritual"]
    },
    {
        id: 'e13',
        title: "Confidence to Speak Up",
        body: "I was terrified of public speaking. I had opportunities I couldn't take because of fear. I started making dua in tahajjud for the confidence that comes from knowing who sent you. Slowly the fear transformed. I recently gave a TEDx talk. The confidence I needed was never in myself — it was in the One behind me.",
        author: "Zahra N.",
        location: "Amsterdam, Netherlands",
        reactions: 131,
        tags: ["Success", "Career"]
    },
    {
        id: 'e14',
        title: "When Quitting Was the Wrong Answer",
        body: "I was close to giving up on my studies. The programme was too hard and I felt out of my depth. I prayed tahajjud and asked for sabr. I also asked for a sign — stay or leave. Every sign said stay. I stayed. The hardest year became my most transformative. Tahajjud kept me in the room.",
        author: "Osman A.",
        location: "Gothenburg, Sweden",
        reactions: 76,
        tags: ["Education", "Success"]
    },
    {
        id: 'e15',
        title: "The Sports Career That Almost Didn't Happen",
        body: "I had a serious injury the year I was meant to go professional. I thought my career was over. I prayed tahajjud with everything I had, not asking to be great but asking for shifa and guidance. I recovered faster than expected, signed my contract, and have since attributed every goal to Allah. The pitch is my sujood.",
        author: "Hassan R.",
        location: "Casablanca, Morocco",
        reactions: 153,
        tags: ["Success", "Health"]
    },
];

export const storyTopics = ["All", "Career", "Marriage", "Anxiety", "Health", "Forgiveness", "Spiritual", "Education", "Success", "Family", "Peace", "Rizq"];
