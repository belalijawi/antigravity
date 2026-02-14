// Dua database with Arabic, transliteration, and translation
export interface Dua {
    id: string;
    category: string;
    title: string;
    arabic: string;
    transliteration: string;
    translation: string;
    source: string;
}

export const duaDatabase: Dua[] = [
    // Jannah & Afterlife
    {
        id: 'jannah-1',
        category: 'Jannah',
        title: 'For Entry into Jannah',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ وَأَعُوذُ بِكَ مِنَ النَّارِ',
        transliteration: 'Allahumma inni as\'aluka al-jannata wa a\'oodhu bika minan-naar',
        translation: 'O Allah, I ask You for Paradise and I seek refuge in You from the Fire',
        source: 'Abu Dawud'
    },
    {
        id: 'jannah-2',
        category: 'Jannah',
        title: 'For Firdaus (Highest Paradise)',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْفِرْدَوْسَ الْأَعْلَى',
        transliteration: 'Allahumma inni as\'aluka al-firdawsa al-a\'la',
        translation: 'O Allah, I ask You for the highest level of Paradise (Firdaus)',
        source: 'Authentic Dua'
    },
    {
        id: 'jannah-3',
        category: 'Jannah',
        title: 'For Good End',
        arabic: 'اللَّهُمَّ أَحْسِنْ عَاقِبَتَنَا فِي الْأُمُورِ كُلِّهَا وَأَجِرْنَا مِنْ خِزْيِ الدُّنْيَا وَعَذَابِ الْآخِرَةِ',
        transliteration: 'Allahumma ahsin \'aaqibatana fil-umoori kulliha wa ajirnaa min khizyid-dunya wa \'adhaabil-aakhirah',
        translation: 'O Allah, make good our end in all affairs, and protect us from disgrace in this world and punishment in the Hereafter',
        source: 'Ahmad'
    },

    // Comprehensive Dua
    {
        id: 'comprehensive-1',
        category: 'Success',
        title: 'Comprehensive Dua',
        arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
        transliteration: 'Rabbana aatina fid-dunya hasanatan wa fil-aakhirati hasanatan wa qina \'adhaaban-naar',
        translation: 'Our Lord, give us in this world good and in the Hereafter good and protect us from the punishment of the Fire',
        source: 'Quran 2:201'
    },

    // Anxiety & Distress
    {
        id: 'anxiety-1',
        category: 'Anxiety',
        title: 'Dua of Yunus (AS)',
        arabic: 'لَا إِلَٰهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ',
        transliteration: 'Laa ilaaha illaa anta subhaanaka inni kuntu minaz-zaalimeen',
        translation: 'There is no deity except You; exalted are You. Indeed, I have been of the wrongdoers',
        source: 'Quran 21:87'
    },

    // Wealth & Provision
    {
        id: 'wealth-1',
        category: 'Wealth',
        title: 'For Halal Provision',
        arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ، وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ',
        transliteration: 'Allahumma ikfini bi-halaalika \'an haraamika, wa aghnini bi-fadlika \'amman siwaaka',
        translation: 'O Allah, make what is lawful enough for me, as opposed to what is unlawful, and spare me by Your grace, of need of others',
        source: 'Tirmidhi'
    },

    // Family
    {
        id: 'family-1',
        category: 'Family',
        title: 'For Righteous Offspring',
        arabic: 'رَبِّ هَبْ لِي مِن لَّدُنكَ ذُرِّيَّةً طَيِّبَةً إِنَّكَ سَمِيعُ الدُّعَاءِ',
        transliteration: 'Rabbi hab lee min ladunka dhurriyyatan tayyibatan innaka samee-ud-du\'aa',
        translation: 'My Lord, grant me from Yourself a good offspring. Indeed, You are the Hearer of supplication',
        source: 'Quran 3:38'
    },
    {
        id: 'family-2',
        category: 'Family',
        title: 'For Spouse and Children',
        arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
        transliteration: 'Rabbana hab lana min azwajina wa dhurriyyatina qurrata a\'yunin waj\'alna lil-muttaqeena imaama',
        translation: 'Our Lord, grant us from among our spouses and offspring comfort to our eyes and make us an example for the righteous',
        source: 'Quran 25:74'
    },
    {
        id: 'family-3',
        category: 'Family',
        title: 'For Parents',
        arabic: 'رَبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
        transliteration: 'Rabbi irhamhuma kama rabbayani sagheera',
        translation: 'My Lord, have mercy upon them as they brought me up when I was small',
        source: 'Quran 17:24'
    },
    {
        id: 'family-4',
        category: 'Family',
        title: 'For Parents\' Forgiveness',
        arabic: 'رَبِّ اغْفِرْ لِي وَلِوَالِدَيَّ وَلِلْمُؤْمِنِينَ يَوْمَ يَقُومُ الْحِسَابُ',
        transliteration: 'Rabbighfir li wa li-walidayya wa lil-mu\'mineena yawma yaqoomul-hisaab',
        translation: 'My Lord, forgive me and my parents and the believers the Day the account is established',
        source: 'Quran 14:41'
    },
    {
        id: 'family-5',
        category: 'Family',
        title: 'For Parents\' Well-being',
        arabic: 'اللَّهُمَّ اغْفِرْ لِوَالِدَيَّ وَارْحَمْهُمَا وَعَافِهِمَا وَاعْفُ عَنْهُمَا',
        transliteration: 'Allahumma ighfir li-walidayya warhamhuma wa \'afihima wa\'fu \'anhuma',
        translation: 'O Allah, forgive my parents, have mercy on them, grant them health, and pardon them',
        source: 'Authentic Dua'
    },

    // Friends & Loved Ones
    {
        id: 'friends-1',
        category: 'Friends',
        title: 'For Righteous Friends',
        arabic: 'رَبَّنَا اغْفِرْ لَنَا وَلِإِخْوَانِنَا الَّذِينَ سَبَقُونَا بِالْإِيمَانِ',
        transliteration: 'Rabbana ighfir lana wa li-ikhwanina alladheena sabaqoona bil-iman',
        translation: 'Our Lord, forgive us and our brothers who preceded us in faith',
        source: 'Quran 59:10'
    },
    {
        id: 'friends-2',
        category: 'Friends',
        title: 'For Friends\' Guidance',
        arabic: 'اللَّهُمَّ اهْدِ قَوْمِي فَإِنَّهُمْ لَا يَعْلَمُونَ',
        transliteration: 'Allahumma ihdi qawmi fa-innahum la ya\'lamoon',
        translation: 'O Allah, guide my people for they do not know',
        source: 'Bukhari & Muslim'
    },
    {
        id: 'friends-3',
        category: 'Friends',
        title: 'For Friends\' Success',
        arabic: 'اللَّهُمَّ أَصْلِحْ لِي فِي ذُرِّيَّتِي وَأَصْلِحْ لِي فِي إِخْوَانِي',
        transliteration: 'Allahumma aslih li fi dhurriyyati wa aslih li fi ikhwani',
        translation: 'O Allah, make righteous for me my offspring and make righteous for me my brothers',
        source: 'Authentic Dua'
    },
    {
        id: 'friends-4',
        category: 'Friends',
        title: 'For Loved Ones',
        arabic: 'اللَّهُمَّ اغْفِرْ لِلْمُؤْمِنِينَ وَالْمُؤْمِنَاتِ وَالْمُسْلِمِينَ وَالْمُسْلِمَاتِ الْأَحْيَاءِ مِنْهُمْ وَالْأَمْوَاتِ',
        transliteration: 'Allahumma ighfir lil-mu\'mineena wal-mu\'minati wal-muslimeena wal-muslimati al-ahya\'i minhum wal-amwat',
        translation: 'O Allah, forgive the believing men and believing women, the Muslim men and Muslim women, the living among them and the dead',
        source: 'Muslim'
    },

    // Health
    {
        id: 'health-1',
        category: 'Health',
        title: 'For Healing',
        arabic: 'اللَّهُمَّ رَبَّ النَّاسِ، أَذْهِبِ الْبَأْسَ، اشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا',
        transliteration: 'Allahumma Rabban-naas, adh-hibil-ba\'s, ishfi antash-Shaafi, laa shifaa\'a illaa shifaa\'uka, shifaa\'an laa yughaadiru saqamaa',
        translation: 'O Allah, Lord of mankind, remove the harm and heal, You are the Healer. There is no healing except Your healing, a healing that leaves no disease',
        source: 'Bukhari & Muslim'
    },

    // Protection
    {
        id: 'protection-1',
        category: 'Protection',
        title: 'For Protection from Evil',
        arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
        transliteration: 'A\'oodhu bi kalimaatil-laahit-taammaati min sharri maa khalaq',
        translation: 'I seek refuge in the perfect words of Allah from the evil of what He has created',
        source: 'Muslim'
    },

    // Guidance
    {
        id: 'guidance-1',
        category: 'Guidance',
        title: 'For Guidance',
        arabic: 'اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي',
        transliteration: 'Allahumma ihdini wa saddidni',
        translation: 'O Allah, guide me and make me steadfast',
        source: 'Muslim'
    },
    {
        id: 'guidance-2',
        category: 'Guidance',
        title: 'For Right Path',
        arabic: 'اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ',
        transliteration: 'Ihdinaa as-siraatal mustaqeem',
        translation: 'Guide us to the straight path',
        source: 'Quran 1:6'
    },

    // Forgiveness
    {
        id: 'forgiveness-1',
        category: 'Forgiveness',
        title: 'Sayyidul Istighfar',
        arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ',
        transliteration: 'Allahumma anta Rabbi la ilaha illa anta, khalaqtani wa ana \'abduka, wa ana \'ala \'ahdika wa wa\'dika mas-tata\'tu',
        translation: 'O Allah, You are my Lord, there is no god but You. You created me and I am Your servant, and I am upon Your covenant and promise as much as I can',
        source: 'Bukhari'
    },

    // Knowledge
    {
        id: 'knowledge-1',
        category: 'Knowledge',
        title: 'For Beneficial Knowledge',
        arabic: 'اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي، وَعَلِّمْنِي مَا يَنْفَعُنِي، وَزِدْنِي عِلْمًا',
        transliteration: 'Allahumma infa\'ni bima \'allamtani, wa \'allimni ma yanfa\'uni, wa zidni \'ilma',
        translation: 'O Allah, benefit me with what You have taught me, teach me what will benefit me, and increase me in knowledge',
        source: 'Tirmidhi'
    },
    {
        id: 'knowledge-2',
        category: 'Knowledge',
        title: 'For Understanding',
        arabic: 'رَبِّ زِدْنِي عِلْمًا',
        transliteration: 'Rabbi zidni \'ilma',
        translation: 'My Lord, increase me in knowledge',
        source: 'Quran 20:114'
    },

    // Morning & Evening
    {
        id: 'morning-1',
        category: 'Morning & Evening',
        title: 'Ayat al-Kursi',
        arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ',
        transliteration: 'Allahu laa ilaaha illaa huwal-hayyul-qayyoom, laa ta\'khudhuhu sinatun wa laa nawm',
        translation: 'Allah - there is no deity except Him, the Ever-Living, the Sustainer of existence. Neither drowsiness overtakes Him nor sleep',
        source: 'Quran 2:255'
    },

    // Gratitude
    {
        id: 'gratitude-1',
        category: 'Gratitude',
        title: 'For Thankfulness',
        arabic: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
        transliteration: 'Alhamdulillahi Rabbil-\'aalameen',
        translation: 'All praise is due to Allah, Lord of all the worlds',
        source: 'Quran 1:2'
    },

    // Protection from Sin & Temptation
    {
        id: 'sin-1',
        category: 'Sin & Temptation',
        title: 'For Protection from Zina',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْهُدَى وَالتُّقَى وَالْعَفَافَ وَالْغِنَى',
        transliteration: 'Allahumma inni as\'aluka al-huda wat-tuqa wal-\'afafa wal-ghina',
        translation: 'O Allah, I ask You for guidance, piety, chastity, and self-sufficiency',
        source: 'Muslim'
    },
    {
        id: 'sin-2',
        category: 'Sin & Temptation',
        title: 'For Strength Against Desires',
        arabic: 'اللَّهُمَّ حَبِّبْ إِلَيَّ الْإِيمَانَ وَزَيِّنْهُ فِي قَلْبِي، وَكَرِّهْ إِلَيَّ الْكُفْرَ وَالْفُسُوقَ وَالْعِصْيَانَ',
        transliteration: 'Allahumma habbib ilayyal-iman wa zayyinhu fi qalbi, wa karrih ilayyal-kufra wal-fusuqa wal-\'isyan',
        translation: 'O Allah, make faith beloved to me and beautify it in my heart, and make disbelief, wickedness, and disobedience hateful to me',
        source: 'Ahmad'
    },
    {
        id: 'sin-3',
        category: 'Sin & Temptation',
        title: 'For Leaving Bad Habits',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ مُنْكَرَاتِ الْأَخْلَاقِ وَالْأَعْمَالِ وَالْأَهْوَاءِ',
        transliteration: 'Allahumma inni a\'oodhu bika min munkaratil-akhlaqi wal-a\'mali wal-ahwa',
        translation: 'O Allah, I seek refuge in You from evil character, evil deeds, and evil desires',
        source: 'Tirmidhi'
    },

    // Evil Eye & Envy
    {
        id: 'evileye-1',
        category: 'Evil Eye',
        title: 'Protection from Evil Eye',
        arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ',
        transliteration: 'A\'oodhu bi kalimaatil-laahit-taammati min kulli shaytanin wa haammatin wa min kulli \'aynin laammah',
        translation: 'I seek refuge in the perfect words of Allah from every devil and every poisonous creature, and from every evil eye',
        source: 'Bukhari'
    },
    {
        id: 'evileye-2',
        category: 'Evil Eye',
        title: 'Ruqyah for Evil Eye',
        arabic: 'بِسْمِ اللَّهِ أَرْقِيكَ، مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ، مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ اللَّهُ يَشْفِيكَ',
        transliteration: 'Bismillahi arqika, min kulli shay\'in yu\'dhika, min sharri kulli nafsin aw \'aynin hasidin Allahu yashfik',
        translation: 'In the name of Allah I recite over you, from everything that harms you, from the evil of every soul or envious eye, may Allah heal you',
        source: 'Muslim'
    },

    // Addiction & Bad Habits
    {
        id: 'addiction-1',
        category: 'Sin & Temptation',
        title: 'For Breaking Addiction',
        arabic: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً',
        transliteration: 'Rabbana la tuzigh quloobana ba\'da idh hadaytana wa hab lana min ladunka rahmah',
        translation: 'Our Lord, let not our hearts deviate after You have guided us and grant us from Yourself mercy',
        source: 'Quran 3:8'
    },

    // Repentance
    {
        id: 'repentance-1',
        category: 'Forgiveness',
        title: 'For Sincere Repentance',
        arabic: 'أَسْتَغْفِرُ اللَّهَ الَّذِي لَا إِلَهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ وَأَتُوبُ إِلَيْهِ',
        transliteration: 'Astaghfirullaha alladhi la ilaha illa huwal-hayyul-qayyoomu wa atoobu ilayh',
        translation: 'I seek forgiveness from Allah, there is no god but Him, the Ever-Living, the Sustainer, and I repent to Him',
        source: 'Abu Dawud'
    },

    // Spiritual Weakness
    {
        id: 'spiritual-1',
        category: 'Guidance',
        title: 'For Strengthening Faith',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ إِيمَانًا لَا يَرْتَدُّ، وَنَعِيمًا لَا يَنْفَدُ',
        transliteration: 'Allahumma inni as\'aluka imanan la yartaddu, wa na\'eeman la yanfad',
        translation: 'O Allah, I ask You for faith that does not waver, and bliss that never ends',
        source: 'Ahmad'
    },

    // Loneliness & Sadness
    {
        id: 'sadness-1',
        category: 'Anxiety',
        title: 'For Loneliness and Sadness',
        arabic: 'اللَّهُمَّ إِنِّي عَبْدُكَ ابْنُ عَبْدِكَ ابْنُ أَمَتِكَ، نَاصِيَتِي بِيَدِكَ، مَاضٍ فِيَّ حُكْمُكَ، عَدْلٌ فِيَّ قَضَاؤُكَ، أَسْأَلُكَ بِكُلِّ اسْمٍ هُوَ لَكَ أَنْ تَجْعَلَ الْقُرْآنَ رَبِيعَ قَلْبِي',
        transliteration: 'Allahumma inni \'abduka ibnu \'abdika ibnu amatika, naasiyati biyadika, maadin fiyya hukmuka, \'adlun fiyya qadaa\'uka, as\'aluka bikulli ismin huwa laka an taj\'alal-Qur\'ana rabee\'a qalbi',
        translation: 'O Allah, I am Your servant, son of Your servant, son of Your maidservant. My forelock is in Your hand, Your command over me is forever executed, and Your decree over me is just. I ask You by every name that is Yours to make the Quran the spring of my heart',
        source: 'Ahmad'
    },

    // Marriage & Relationships
    {
        id: 'marriage-2',
        category: 'Family',
        title: 'For Finding a Righteous Spouse',
        arabic: 'رَبِّ هَبْ لِي مِن لَّدُنكَ ذُرِّيَّةً طَيِّبَةً إِنَّكَ سَمِيعُ الدُّعَاءِ',
        transliteration: 'Rabbi hab li min ladunka dhurriyyatan tayyibah, innaka samee\'ud-du\'aa',
        translation: 'My Lord, grant me from Yourself a good offspring. Indeed, You are the Hearer of supplication',
        source: 'Quran 3:38'
    },

    // Enemies & Oppression
    {
        id: 'oppression-1',
        category: 'Protection',
        title: 'Against Oppressors',
        arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
        transliteration: 'Hasbunallahu wa ni\'mal-wakeel',
        translation: 'Sufficient for us is Allah, and He is the best Disposer of affairs',
        source: 'Quran 3:173'
    },

    // For the Ummah & Oppressed
    {
        id: 'ummah-1',
        category: 'Ummah',
        title: 'For Palestine',
        arabic: 'اللَّهُمَّ انْصُرْ إِخْوَانَنَا فِي فِلَسْطِينَ، اللَّهُمَّ كُنْ لَهُمْ مُعِينًا وَنَصِيرًا، اللَّهُمَّ ارْفَعْ عَنْهُمُ الْبَلَاءَ وَالظُّلْمَ',
        transliteration: 'Allahumma unsur ikhwanana fi Filasteen, Allahumma kun lahum mu\'inan wa naseera, Allahummarf\'a \'anhumul-balaa\'a wadh-dhulm',
        translation: 'O Allah, grant victory to our brothers and sisters in Palestine. O Allah, be their helper and supporter. O Allah, remove from them affliction and oppression',
        source: 'Authentic Dua'
    },
    {
        id: 'ummah-2',
        category: 'Ummah',
        title: 'For Sudan and All Oppressed',
        arabic: 'اللَّهُمَّ انْصُرْ الْمُسْتَضْعَفِينَ مِنَ الْمُؤْمِنِينَ فِي كُلِّ مَكَانٍ، اللَّهُمَّ فُكَّ أَسْرَهُمْ وَارْحَمْ ضَعْفَهُمْ',
        transliteration: 'Allahumma unsuril-mustad\'afeena minal-mu\'mineena fi kulli makan, Allahumma fukka asrahum warham da\'fahum',
        translation: 'O Allah, grant victory to the oppressed believers in every place. O Allah, free their captives and have mercy on their weakness',
        source: 'Authentic Dua'
    },
    {
        id: 'ummah-3',
        category: 'Ummah',
        title: 'For the Suffering Ummah',
        arabic: 'اللَّهُمَّ أَصْلِحْ أَحْوَالَ الْمُسْلِمِينَ فِي كُلِّ مَكَانٍ، اللَّهُمَّ وَحِّدْ صُفُوفَهُمْ وَاجْمَعْ كَلِمَتَهُمْ',
        transliteration: 'Allahumma aslih ahwaalal-muslimeena fi kulli makan, Allahumma wahhid sufoofhum wajma\' kalimatahum',
        translation: 'O Allah, rectify the affairs of the Muslims in every place. O Allah, unite their ranks and bring together their word',
        source: 'Authentic Dua'
    },
    {
        id: 'ummah-4',
        category: 'Ummah',
        title: 'For Victory Over Oppressors',
        arabic: 'اللَّهُمَّ مُنْزِلَ الْكِتَابِ، سَرِيعَ الْحِسَابِ، اهْزِمِ الْأَحْزَابَ، اللَّهُمَّ اهْزِمْهُمْ وَزَلْزِلْهُمْ',
        transliteration: 'Allahumma munzilal-kitab, saree\'al-hisab, ihzimil-ahzab, Allahummahzimhum wa zalzilhum',
        translation: 'O Allah, Revealer of the Book, Swift in taking account, defeat the confederates. O Allah, defeat them and shake them',
        source: 'Bukhari & Muslim'
    },
    {
        id: 'ummah-5',
        category: 'Ummah',
        title: 'For Martyrs and Wounded',
        arabic: 'اللَّهُمَّ تَقَبَّلْ شُهَدَاءَنَا، وَاشْفِ جَرْحَانَا، وَفُكَّ أَسْرَانَا',
        transliteration: 'Allahumma taqabbal shuhadaa\'ana, washfi jarhaana, wa fukka asraana',
        translation: 'O Allah, accept our martyrs, heal our wounded, and free our prisoners',
        source: 'Authentic Dua'
    },
    {
        id: 'ummah-6',
        category: 'Ummah',
        title: 'For Al-Aqsa Mosque',
        arabic: 'اللَّهُمَّ احْفَظِ الْمَسْجِدَ الْأَقْصَى وَأَهْلَهُ، اللَّهُمَّ طَهِّرْهُ مِنَ الْمُحْتَلِّينَ',
        transliteration: 'Allahumma ihfadh al-Masjidal-Aqsa wa ahlahu, Allahumma tahhirhu minal-muhtilleen',
        translation: 'O Allah, protect Al-Aqsa Mosque and its people. O Allah, purify it from the occupiers',
        source: 'Authentic Dua'
    },
    {
        id: 'ummah-7',
        category: 'Ummah',
        title: 'For Muslim Unity',
        arabic: 'اللَّهُمَّ أَلِّفْ بَيْنَ قُلُوبِ الْمُسْلِمِينَ، وَأَصْلِحْ ذَاتَ بَيْنِهِمْ',
        transliteration: 'Allahumma allif bayna quloobil-muslimeen, wa aslih dhaata baynihim',
        translation: 'O Allah, unite the hearts of the Muslims and reconcile their differences',
        source: 'Authentic Dua'
    },
    {
        id: 'ummah-8',
        category: 'Ummah',
        title: 'For Oppressed Children',
        arabic: 'اللَّهُمَّ ارْحَمْ أَطْفَالَ الْمُسْلِمِينَ الْمُسْتَضْعَفِينَ، اللَّهُمَّ احْفَظْهُمْ وَارْزُقْهُمُ الْأَمْنَ وَالسَّلَامَ',
        transliteration: 'Allahumma irham atfaalal-muslimeena al-mustad\'afeen, Allahumma ihfadhum warzuqhumul-amna was-salaam',
        translation: 'O Allah, have mercy on the oppressed children of the Muslims. O Allah, protect them and grant them safety and peace',
        source: 'Authentic Dua'
    },
];

export const categories = [
    'All',
    'Jannah',
    'Ummah',
    'Sin & Temptation',
    'Evil Eye',
    'Morning & Evening',
    'Wealth',
    'Family',
    'Friends',
    'Health',
    'Protection',
    'Guidance',
    'Forgiveness',
    'Success',
    'Knowledge',
    'Anxiety',
    'Gratitude',
];
