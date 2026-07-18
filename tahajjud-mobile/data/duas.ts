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
    // ── Daily Routine (Hisnul Muslim) ──

    // Waking Up
    {
        id: 'daily-wake-1',
        category: 'Daily Routine',
        title: 'Upon Waking Up',
        arabic: 'الحَمْدُ لِلّهِ الّذي أَحْيانا بَعْدَ ما أَماتَنا وَإِليهِ النُّشور',
        transliteration: 'Alhamdu lillahil-ladhi ahyana ba\'da ma amatana wa ilayhin-nushoor',
        translation: 'All praise is for Allah who gave us life after having taken it from us and unto Him is the resurrection.',
        source: 'Bukhari 6325'
    },

    // Before Sleeping
    {
        id: 'daily-sleep-1',
        category: 'Daily Routine',
        title: 'Before Sleeping',
        arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيا',
        transliteration: 'Bismika Allahumma amootu wa ahya',
        translation: 'In Your name O Allah, I die and I live.',
        source: 'Bukhari 6312'
    },
    {
        id: 'daily-sleep-2',
        category: 'Daily Routine',
        title: 'Entrusting to Allah Before Sleep',
        arabic: 'اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَوَجَّهْتُ وَجْهِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لا مَلْجَأَ وَلا مَنْجَا مِنْكَ إِلاَّ إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ',
        transliteration: 'Allahumma aslamtu nafsi ilayk, wa fawwadtu amri ilayk, wa wajjahtu wajhi ilayk, wa alja\'tu dhahri ilayk, raghbatan wa rahbatan ilayk, la malja\'a wa la manja minka illa ilayk, amantu bikitabikal-ladhi anzalta wa binabiyyikal-ladhi arsalt',
        translation: 'O Allah, I submit myself to You, entrust my affairs to You, turn my face toward You, and place my back against You out of desire and fear of You. There is no refuge and no escape from You except to You. I believe in Your Book which You revealed and Your Prophet whom You sent.',
        source: 'Bukhari 247 · Muslim 2710'
    },

    // Eating & Drinking
    {
        id: 'daily-eat-1',
        category: 'Daily Routine',
        title: 'Before Eating',
        arabic: 'بِسْمِ اللَّهِ',
        transliteration: 'Bismillah',
        translation: 'In the name of Allah. (If you forget at the start, say: In the name of Allah in its beginning and its end.)',
        source: 'Abu Dawud 3767 · Tirmidhi 1858'
    },
    {
        id: 'daily-eat-2',
        category: 'Daily Routine',
        title: 'After Eating',
        arabic: 'الحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلا قُوَّة',
        transliteration: 'Alhamdu lillahil-ladhi at\'amani hadha wa razaqanihi min ghayri hawlin minni wa la quwwah',
        translation: 'All praise is for Allah who fed me this and provided it for me without any might nor power from myself.',
        source: 'Abu Dawud 4023 · Tirmidhi 3458'
    },

    // Toilet
    {
        id: 'daily-toilet-1',
        category: 'Daily Routine',
        title: 'Before Entering the Toilet',
        arabic: 'بِسْمِ اللَّهِ، اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْخُبْثِ وَالْخَبَائِث',
        transliteration: 'Bismillah, Allahumma inni a\'udhu bika minal-khubth wal-khaba\'ith',
        translation: 'In the name of Allah. O Allah, I seek Your protection from evil and evil-doers.',
        source: 'Bukhari 142 · Muslim 375'
    },
    {
        id: 'daily-toilet-2',
        category: 'Daily Routine',
        title: 'After Leaving the Toilet',
        arabic: 'غُفْرَانَكَ',
        transliteration: 'Ghufraanak',
        translation: 'I ask You for forgiveness.',
        source: 'Abu Dawud 30 · Tirmidhi 7'
    },

    // Home
    {
        id: 'daily-home-1',
        category: 'Daily Routine',
        title: 'When Leaving the Home',
        arabic: 'بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، وَلا حَوْلَ وَلا قُوَّةَ إِلَّا بِاللَّهِ',
        transliteration: 'Bismillah, tawakkaltu \'alallah, wa la hawla wa la quwwata illa billah',
        translation: 'In the name of Allah, I place my trust in Allah, and there is no might nor power except with Allah.',
        source: 'Abu Dawud 5095 · Tirmidhi 3426'
    },
    {
        id: 'daily-home-2',
        category: 'Daily Routine',
        title: 'When Entering the Home',
        arabic: 'بِسْمِ اللَّهِ وَلَجْنَا، وَبِسْمِ اللَّهِ خَرَجْنَا، وَعَلَى رَبِّنَا تَوَكَّلْنَا',
        transliteration: 'Bismillahi walajnaa, wa bismillahi kharajnaa, wa \'ala rabbina tawakkalnaa',
        translation: 'In the name of Allah we enter, in the name of Allah we leave, and upon our Lord we place our trust.',
        source: 'Abu Dawud 5096'
    },

    // Wudu
    {
        id: 'daily-wudu-1',
        category: 'Daily Routine',
        title: 'After Completing Wudu',
        arabic: 'أَشْهَدُ أَنْ لا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّداً عَبْدُهُ وَرَسُولُهُ',
        transliteration: 'Ash-hadu an la ilaha illallahu wahdahu la sharika lah, wa ash-hadu anna Muhammadan \'abduhu wa rasooluh',
        translation: 'I bear witness that none has the right to be worshipped except Allah, alone without partner, and I bear witness that Muhammad is His slave and Messenger.',
        source: 'Muslim 234'
    },
    {
        id: 'daily-wudu-2',
        category: 'Daily Routine',
        title: 'Dua After Wudu',
        arabic: 'اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِين',
        transliteration: 'Allahumma ij\'alni minat-tawwabeena waj\'alni minal-mutatahhireen',
        translation: 'O Allah, make me of those who constantly repent to You and make me of those who keep themselves pure.',
        source: 'Tirmidhi 55'
    },

    // Morning & Evening
    {
        id: 'daily-morning-1',
        category: 'Daily Routine',
        title: 'Morning Tawakkul',
        arabic: 'حَسْبِيَ اللَّهُ لا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيم',
        transliteration: 'Hasbiyallahu la ilaha illa huwa \'alayhi tawakkaltu wa huwa rabbul-\'arshil-\'adheem',
        translation: 'Allah is sufficient for me, none has the right to be worshipped except Him, upon Him I rely, and He is the Lord of the exalted throne.',
        source: 'Abu Dawud 5081 · Recited 7× morning & evening'
    },

    // Anxiety
    {
        id: 'daily-anxiety-1',
        category: 'Daily Routine',
        title: 'Dua for Anxiety & Sorrow',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْبُخْلِ وَالْجُبْنِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَال',
        transliteration: 'Allahumma inni a\'udhu bika minal-hammi wal-hazan, wal-\'ajzi wal-kasal, wal-bukhli wal-jubn, wa dhala\'id-dayni wa ghalabatir-rijal',
        translation: 'O Allah, I take refuge in You from anxiety and sorrow, weakness and laziness, miserliness and cowardice, and the burden of debts and from being overpowered by men.',
        source: 'Bukhari 6369'
    },

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
        category: 'Marriage & Love',
        title: 'Seeking a Spouse — Dua of Musa',
        arabic: 'رَبِّ إِنِّي لِمَا أَنزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ',
        transliteration: 'Rabbi inni lima anzalta ilayya min khayrin faqir',
        translation: 'My Lord, I am in absolute need of whatever good You send down to me. (Musa made this dua alone and homeless — soon after, he was offered marriage, a home, and work. A dua of complete need for anyone seeking a spouse.)',
        source: 'Quran 28:24'
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

    // ── Travel ──────────────────────────────────────────────────────────────
    {
        id: 'travel-1',
        category: 'Travel',
        title: 'Before Travelling',
        arabic: 'اللَّهُمَّ إِنَّا نَسْأَلُكَ فِي سَفَرِنَا هَذَا الْبِرَّ وَالتَّقْوَى، وَمِنَ الْعَمَلِ مَا تَرْضَى',
        transliteration: 'Allahumma inna nas\'aluka fi safarina hadhal-birra wat-taqwa, wa minal-\'amali ma tardha',
        translation: 'O Allah, we ask You on this journey for righteousness and piety, and for deeds that please You.',
        source: 'Muslim 1342'
    },
    {
        id: 'travel-2',
        category: 'Travel',
        title: 'Boarding a Vehicle',
        arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ',
        transliteration: 'Subhanal-ladhi sakhkhara lana hadha wa ma kunna lahu muqrineen, wa inna ila Rabbina lamunqaliboon',
        translation: 'Glory be to Him who has subjected this for us, as we were not able to do it ourselves. Surely to our Lord we shall return.',
        source: 'Abu Dawud 2602'
    },
    {
        id: 'travel-3',
        category: 'Travel',
        title: 'Returning from Travel',
        arabic: 'آيِبُونَ تَائِبُونَ عَابِدُونَ لِرَبِّنَا حَامِدُونَ',
        transliteration: 'Aa\'iboona, taa\'iboona, \'aabidoona, li Rabbina haamidoon',
        translation: 'We return, repent, worship, and praise our Lord.',
        source: 'Bukhari 1797'
    },
    {
        id: 'travel-4',
        category: 'Travel',
        title: 'Upon Entering a Town',
        arabic: 'اللَّهُمَّ بَارِكْ لَنَا فِيهَا',
        transliteration: 'Allahumma barik lana fiha',
        translation: 'O Allah, bless us in it.',
        source: 'Authentic Dua'
    },

    // ── Ramadan ──────────────────────────────────────────────────────────────
    {
        id: 'ramadan-1',
        category: 'Ramadan',
        title: 'Sighting the Ramadan Moon',
        arabic: 'اللَّهُمَّ أَهِلَّهُ عَلَيْنَا بِالْأَمْنِ وَالْإِيمَانِ، وَالسَّلَامَةِ وَالْإِسْلَامِ، وَالتَّوْفِيقِ لِمَا تُحِبُّ وَتَرْضَى',
        transliteration: 'Allahumma ahillahu \'alayna bil-amni wal-iman, was-salamati wal-islam, wat-tawfiqi lima tuhibbu wa tardha',
        translation: 'O Allah, let this moon appear on us with security and faith, with safety and Islam, and with the ability to do what You love and are pleased with.',
        source: 'Tirmidhi 3451'
    },
    {
        id: 'ramadan-2',
        category: 'Ramadan',
        title: 'Breaking the Fast (Iftar)',
        arabic: 'اللَّهُمَّ لَكَ صُمْتُ وَعَلَى رِزْقِكَ أَفْطَرْتُ',
        transliteration: 'Allahumma laka sumtu wa \'ala rizqika aftartu',
        translation: 'O Allah, for You I fasted and with Your provision I break my fast.',
        source: 'Abu Dawud 2358'
    },
    {
        id: 'ramadan-3',
        category: 'Ramadan',
        title: 'Laylatul Qadr Dua',
        arabic: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
        transliteration: 'Allahumma innaka \'afuwwun tuhibbul-\'afwa fa\'fu \'anni',
        translation: 'O Allah, You are the Pardoner and You love pardon, so pardon me.',
        source: 'Tirmidhi 3513 · Ibn Majah 3850'
    },
    {
        id: 'ramadan-4',
        category: 'Ramadan',
        title: 'Intention to Fast',
        arabic: 'نَوَيْتُ صَوْمَ غَدٍ مِنْ شَهْرِ رَمَضَانَ الْمُبَارَكِ فَرْضًا لَكَ يَا اللَّه',
        transliteration: 'Nawaytu sawma ghadin min shahri Ramadhanal-mubaraki fardhan laka ya Allah',
        translation: 'I intend to fast tomorrow in the blessed month of Ramadan as an obligation for You, O Allah.',
        source: 'Traditional Niyyah'
    },

    // ── Salah (Prayer) ───────────────────────────────────────────────────────
    {
        id: 'salah-1',
        category: 'Salah',
        title: 'After Adhan',
        arabic: 'اللَّهُمَّ رَبَّ هَذِهِ الدَّعْوَةِ التَّامَّةِ وَالصَّلَاةِ الْقَائِمَةِ آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ',
        transliteration: 'Allahumma Rabba hadhihid-da\'watit-tammah, was-salatil-qa\'imah, ati Muhammadanil-waseelata wal-fadheelah, wab\'ath-hu maqaman mahmoodanil-ladhi wa\'adtah',
        translation: 'O Allah, Lord of this perfect call and the prayer to be offered, grant Muhammad the intercession and superiority, and raise him to the praised position that You have promised him.',
        source: 'Bukhari 614'
    },
    {
        id: 'salah-2',
        category: 'Salah',
        title: 'Opening of Salah (Istiftah)',
        arabic: 'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ وَتَبَارَكَ اسْمُكَ وَتَعَالَى جَدُّكَ وَلَا إِلَهَ غَيْرُكَ',
        transliteration: 'Subhanakal-Allahumma wa bihamdika wa tabarakas-muka wa ta\'ala jadduka wa la ilaha ghayruk',
        translation: 'Glory be to You, O Allah, and praise. Blessed is Your name and exalted is Your majesty. There is no god but You.',
        source: 'Abu Dawud 775'
    },
    {
        id: 'salah-3',
        category: 'Salah',
        title: 'Du\'a al-Qunoot (Witr)',
        arabic: 'اللَّهُمَّ اهْدِنِي فِيمَنْ هَدَيْتَ، وَعَافِنِي فِيمَنْ عَافَيْتَ، وَتَوَلَّنِي فِيمَنْ تَوَلَّيْتَ، وَبَارِكْ لِي فِيمَا أَعْطَيْتَ',
        transliteration: 'Allahumma ihdini fiman hadayt, wa \'afini fiman \'afayt, wa tawallani fiman tawallayt, wa barik li fima a\'tayt',
        translation: 'O Allah, guide me among those You have guided, pardon me among those You have pardoned, befriend me among those You have befriended, and bless what You have given me.',
        source: 'Abu Dawud 1425'
    },
    {
        id: 'salah-4',
        category: 'Salah',
        title: 'Between Two Sajdahs',
        arabic: 'رَبِّ اغْفِرْ لِي، رَبِّ اغْفِرْ لِي',
        transliteration: 'Rabbighfir li, Rabbighfir li',
        translation: 'My Lord, forgive me. My Lord, forgive me.',
        source: 'Abu Dawud 874'
    },
    {
        id: 'salah-5',
        category: 'Salah',
        title: 'After Tasleem',
        arabic: 'اللَّهُمَّ أَنْتَ السَّلَامُ وَمِنْكَ السَّلَامُ تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ',
        transliteration: 'Allahumma antas-salam wa minkas-salam, tabarakta ya dhal-jalali wal-ikram',
        translation: 'O Allah, You are Peace and from You comes peace. Blessed are You, O Owner of majesty and honour.',
        source: 'Muslim 591'
    },

    // ── Grief & Loss ─────────────────────────────────────────────────────────
    {
        id: 'grief-1',
        category: 'Grief & Loss',
        title: 'Upon Calamity (Inna lillahi)',
        arabic: 'إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ، اللَّهُمَّ أْجُرْنِي فِي مُصِيبَتِي وَأَخْلِفْ لِي خَيْرًا مِنْهَا',
        transliteration: 'Inna lillahi wa inna ilayhi raji\'oon. Allahumma ujurni fi musibati wa akhlif li khayran minha',
        translation: 'Indeed we belong to Allah and to Him we shall return. O Allah, reward me for my calamity and replace it with something better.',
        source: 'Muslim 918'
    },
    {
        id: 'grief-2',
        category: 'Grief & Loss',
        title: 'For the Deceased',
        arabic: 'اللَّهُمَّ اغْفِرْ لَهُ وَارْحَمْهُ وَعَافِهِ وَاعْفُ عَنْهُ',
        transliteration: 'Allahumma ighfir lahu warhamhu wa \'afihi wa\'fu \'anh',
        translation: 'O Allah, forgive him, have mercy on him, grant him well-being, and pardon him.',
        source: 'Muslim 963'
    },
    {
        id: 'grief-3',
        category: 'Grief & Loss',
        title: 'When Overwhelmed by Grief',
        arabic: 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
        transliteration: 'HasbiyAllahu la ilaha illa huwa, \'alayhi tawakkaltu wa huwa Rabbul-\'Arshil-\'Adheem',
        translation: 'Allah is sufficient for me. There is no god but Him. I have placed my trust in Him, and He is the Lord of the Magnificent Throne.',
        source: 'At-Tawbah 9:129'
    },
    {
        id: 'grief-4',
        category: 'Grief & Loss',
        title: 'For a Grieving Heart',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ',
        transliteration: 'Allahumma inni a\'udhu bika minal-hammi wal-hazan',
        translation: 'O Allah, I seek Your refuge from worry and grief.',
        source: 'Bukhari 6369'
    },
    {
        id: 'grief-5',
        category: 'Grief & Loss',
        title: 'Visiting the Graveyard',
        arabic: 'السَّلَامُ عَلَيْكُمْ أَهْلَ الدِّيَارِ مِنَ الْمُؤْمِنِينَ وَالْمُسْلِمِينَ، وَإِنَّا إِنْ شَاءَ اللَّهُ بِكُمْ لَاحِقُونَ',
        transliteration: 'As-salamu \'alaykum ahlad-diyari minal-mu\'mineena wal-muslimeen, wa inna in sha\'Allahu bikum lahiqoon',
        translation: 'Peace be upon you, O people of this abode, among the believers and the Muslims. We will, if Allah wills, join you.',
        source: 'Muslim 975'
    },

    // ── Tawbah (Repentance) ───────────────────────────────────────────────────
    {
        id: 'tawbah-1',
        category: 'Forgiveness',
        title: 'Sayyid al-Istighfar (Master Dua of Forgiveness)',
        arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
        transliteration: 'Allahumma anta Rabbi la ilaha illa anta, khalaqtani wa ana \'abduk, wa ana \'ala \'ahdika wa wa\'dika mastata\'t, a\'udhu bika min sharri ma sana\'t, abu\'u laka bini\'matika \'alayya, wa abu\'u bidhanbee faghfir lee fa\'innahu la yaghfirudh-dhunuba illa ant',
        translation: 'O Allah, You are my Lord, there is no god but You. You created me and I am Your servant. I am upon Your covenant and promise as best I can. I seek refuge in You from the evil of what I have done. I acknowledge Your favour upon me and I acknowledge my sins, so forgive me, for none forgives sins but You.',
        source: 'Bukhari 6306'
    },
    {
        id: 'tawbah-2',
        category: 'Forgiveness',
        title: 'Dua of Prophet Yunus',
        arabic: 'لَا إِلَهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ',
        transliteration: 'La ilaha illa anta subhanaka inni kuntu minadh-dhalimeen',
        translation: 'There is no god but You. Glory be to You. Indeed I have been of the wrongdoers.',
        source: 'Al-Anbiya 21:87'
    },
    {
        id: 'tawbah-3',
        category: 'Forgiveness',
        title: 'For Forgiveness of All Sins',
        arabic: 'اللَّهُمَّ اغْفِرْ لِي ذَنْبِي كُلَّهُ دِقَّهُ وَجِلَّهُ وَأَوَّلَهُ وَآخِرَهُ وَعَلَانِيَتَهُ وَسِرَّهُ',
        transliteration: 'Allahumma ighfir li dhambi kullahu diqqahu wa jillahu wa awwalahu wa akhirahu wa \'alaniyatahu wa sirrahu',
        translation: 'O Allah, forgive me all my sins — the small and the great, the first and the last, the open and the secret.',
        source: 'Muslim 483'
    },
    {
        id: 'tawbah-4',
        category: 'Forgiveness',
        title: 'Seeking Allah\'s Pardon 100 Times',
        arabic: 'رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ إِنَّكَ أَنتَ التَّوَّابُ الرَّحِيم',
        transliteration: 'Rabbighfir li wa tub \'alayya innaka antat-Tawwabur-Raheem',
        translation: 'My Lord, forgive me and accept my repentance. Indeed You are the Ever-Accepting of repentance, the Most Merciful.',
        source: 'Abu Dawud 1516'
    },

    // ── Rizq (Provision) ─────────────────────────────────────────────────────
    {
        id: 'rizq-1',
        category: 'Wealth',
        title: 'For Halal Rizq',
        arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ',
        transliteration: 'Allahumma akfini bihalaalika \'an haramika wa aghnini bifadhlika \'amman siwak',
        translation: 'O Allah, suffice me with Your lawful against Your forbidden, and make me independent of all others besides You through Your bounty.',
        source: 'Tirmidhi 3563'
    },
    {
        id: 'rizq-2',
        category: 'Wealth',
        title: 'Dua of Prophet Ibrahim for Provision',
        arabic: 'رَبِّ إِنَّهُنَّ أَضْلَلْنَ كَثِيرًا مِّنَ النَّاسِ فَمَن تَبِعَنِي فَإِنَّهُ مِنِّي وَمَنْ عَصَانِي فَإِنَّكَ غَفُورٌ رَّحِيمٌ',
        transliteration: 'Rabbij\'alni muqiimas-salati wa min dhurriyyati, Rabbana wa taqabbal du\'aa\'',
        translation: 'My Lord, make me an establisher of prayer, and from my descendants. Our Lord, accept my supplication.',
        source: 'Ibrahim 14:40'
    },
    {
        id: 'rizq-3',
        category: 'Wealth',
        title: 'Against Poverty',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ',
        transliteration: 'Allahumma inni a\'udhu bika minal-kufri wal-faqr',
        translation: 'O Allah, I seek Your protection from disbelief and poverty.',
        source: 'Abu Dawud 5090'
    },
    {
        id: 'rizq-4',
        category: 'Wealth',
        title: 'For Barakah in Earnings',
        arabic: 'اللَّهُمَّ بَارِكْ لَنَا فِيمَا رَزَقْتَنَا وَقِنَا عَذَابَ النَّار',
        transliteration: 'Allahumma barik lana fima razaqtana wa qina \'adhaaban-nar',
        translation: 'O Allah, bless us in what You have provided for us and protect us from the punishment of the Fire.',
        source: 'Authentic Dua'
    },
    {
        id: 'rizq-5',
        category: 'Wealth',
        title: 'Istikharah (Seeking Allah\'s Guidance in Decisions)',
        arabic: 'اللَّهُمَّ إِنِّي أَسْتَخِيرُكَ بِعِلْمِكَ وَأَسْتَقْدِرُكَ بِقُدْرَتِكَ وَأَسْأَلُكَ مِنْ فَضْلِكَ الْعَظِيمِ فَإِنَّكَ تَقْدِرُ وَلَا أَقْدِرُ وَتَعْلَمُ وَلَا أَعْلَمُ وَأَنْتَ عَلَّامُ الْغُيُوبِ',
        transliteration: 'Allahumma inni astakhiruka bi\'ilmika, wa astaqdiruka biqudratika, wa as\'aluka min fadlikal-\'adhim, fa\'innaka taqdiru wa la aqdir, wa ta\'lamu wa la a\'lam, wa anta \'Allamul-ghuyub',
        translation: 'O Allah, I seek Your guidance by Your knowledge, Your ability by Your power, and I ask of You from Your great bounty. For You have power and I do not, You know and I do not know, and You are the Knower of all hidden things.',
        source: 'Bukhari 1166'
    },

    // ── Marriage & Children ────────────────────────────────────────────────────
    {
        id: 'family-extra-1',
        category: 'Marriage & Love',
        title: 'For a Spouse Who Is the Coolness of Your Eyes',
        arabic: 'رَبَّنَا هَبْ لَنَا مِنْ أَزْوَاجِنَا وَذُرِّيَّاتِنَا قُرَّةَ أَعْيُنٍ وَاجْعَلْنَا لِلْمُتَّقِينَ إِمَامًا',
        transliteration: 'Rabbana hab lana min azwajina wa dhurriyyatina qurrata a\'yunin waj\'alna lil-muttaqina imama',
        translation: 'Our Lord, grant us from among our spouses and offspring comfort to our eyes and make us an example for the righteous.',
        source: 'Al-Furqan 25:74'
    },
    {
        id: 'family-extra-2',
        category: 'Marriage & Love',
        title: 'On the Wedding Night',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَ مَا جَبَلْتَهَا عَلَيْهِ وَأَعُوذُ بِكَ مِنْ شَرِّهَا وَشَرِّ مَا جَبَلْتَهَا عَلَيْهِ',
        transliteration: 'Allahumma inni as\'aluka khayrahaa wa khayra ma jabaltaha \'alayh, wa a\'udhu bika min sharriha wa sharri ma jabaltaha \'alayh',
        translation: 'O Allah, I ask You for her goodness and the goodness You have created in her, and I seek refuge in You from her evil and the evil You have created in her.',
        source: 'Abu Dawud 2160'
    },
    {
        id: 'family-extra-3',
        category: 'Marriage & Love',
        title: 'Before Intimacy',
        arabic: 'بِسْمِ اللَّهِ، اللَّهُمَّ جَنِّبْنَا الشَّيْطَانَ وَجَنِّبِ الشَّيْطَانَ مَا رَزَقْتَنَا',
        transliteration: 'Bismillah, Allahumma jannibna ash-shaytana wa jannibish-shaytana ma razaqtana',
        translation: 'In the name of Allah. O Allah, keep us away from Satan and keep Satan away from what You bestow on us.',
        source: 'Bukhari 6388 · Muslim 1434'
    },
    {
        id: 'family-extra-4',
        category: 'Family',
        title: 'For Righteous Children',
        arabic: 'رَبِّ اجْعَلْنِي مُقِيمَ الصَّلَاةِ وَمِن ذُرِّيَّتِي رَبَّنَا وَتَقَبَّلْ دُعَاء',
        transliteration: 'Rabbij\'alni muqimas-salati wa min dhurriyyati, Rabbana wa taqabbal du\'aa\'',
        translation: 'My Lord, make me an establisher of prayer, and from my descendants. Our Lord, accept my supplication.',
        source: 'Ibrahim 14:40'
    },
    {
        id: 'family-extra-5',
        category: 'Family',
        title: 'For Parents',
        arabic: 'رَّبِّ ارْحَمْهُمَا كَمَا رَبَّيَانِي صَغِيرًا',
        transliteration: 'Rabbi irhamhuma kama rabbayani saghira',
        translation: 'My Lord, have mercy on them as they raised me when I was small.',
        source: 'Al-Isra 17:24'
    },

    // ── Morning & Evening Adhkar ───────────────────────────────────────────────
    {
        id: 'morning-adhkar-1',
        category: 'Morning & Evening',
        title: 'Sayyid al-Istighfar (Morning & Evening)',
        arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ لَكَ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
        transliteration: 'Allahumma anta Rabbi la ilaha illa ant, khalaqtani wa ana abduk, wa ana ala ahdika wa wa\'dika mastata\'t, a\'udhu bika min sharri ma sana\'t, abu\'u laka bini\'matika alayy, wa abu\'u bithanbiy, faghfir li fa\'innahu la yaghfirudh-dhunuba illa ant',
        translation: 'O Allah, You are my Lord. There is none worthy of worship except You. You created me and I am Your servant, and I abide by Your covenant and promise as best I can. I seek refuge in You from the evil of what I have done. I acknowledge Your blessing upon me and I acknowledge my sin, so forgive me — for none forgives sins except You. (The master supplication for forgiveness; whoever says it in the morning with conviction, then dies that day, is of the people of Jannah.)',
        source: 'Bukhari 6306'
    },
    {
        id: 'morning-2',
        category: 'Morning & Evening',
        title: 'Morning Remembrance (Asbahna)',
        arabic: 'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ',
        transliteration: 'Asbahna wa asbahal-mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la sharika lah, lahul-mulku walahul-hamd, wa huwa ala kulli shay\'in qadir. Rabbi as\'aluka khayra ma fi hadhal-yawm wa khayra ma ba\'dahu, wa a\'udhu bika min sharri ma fi hadhal-yawm wa sharri ma ba\'dahu',
        translation: 'We have entered a new morning and with it all dominion belongs to Allah. Praise be to Allah. There is none worthy of worship except Allah, alone without partner. To Him belongs dominion and praise, and He is over all things powerful. My Lord, I ask You for the good of this day and the good of what follows, and I seek Your protection from the evil of this day and the evil of what follows.',
        source: 'Muslim 2723'
    },
    {
        id: 'morning-3',
        category: 'Morning & Evening',
        title: 'Evening Remembrance (Amsayna)',
        arabic: 'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
        transliteration: 'Amsayna wa amsal-mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la sharika lah, lahul-mulku walahul-hamd, wa huwa ala kulli shay\'in qadir',
        translation: 'We have entered the evening and with it all dominion belongs to Allah. Praise be to Allah. There is none worthy of worship except Allah, alone without partner. To Him belongs dominion and praise, and He is over all things powerful.',
        source: 'Muslim 2723'
    },
    {
        id: 'morning-4',
        category: 'Morning & Evening',
        title: 'Protection by Allah\'s Names (×3)',
        arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
        transliteration: 'Bismillahil-ladhi la yadurru ma\'a ismihi shay\'un fil-ardi wa la fis-sama\'i wa huwas-Sami\'ul-Alim',
        translation: 'In the name of Allah, with whose name nothing in the earth or heaven can cause harm, and He is the All-Hearing, the All-Knowing. (Whoever recites this 3 times in the morning and 3 times in the evening, nothing will harm him.)',
        source: 'Abu Dawud 5088 · Tirmidhi 3388'
    },
    {
        id: 'morning-5',
        category: 'Morning & Evening',
        title: 'For Pardon and Well-Being',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ',
        transliteration: 'Allahumma inni as\'alukal-afwa wal-afiyata fid-dunya wal-akhirah',
        translation: 'O Allah, I ask You for pardon and well-being in this world and in the Hereafter.',
        source: 'Abu Dawud 5074 · Ibn Majah 3871'
    },
    {
        id: 'morning-6',
        category: 'Morning & Evening',
        title: 'Trusting in Allah (×7)',
        arabic: 'حَسْبِيَ اللَّهُ لَا إِلَهَ إِلَّا هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ',
        transliteration: 'Hasbiyallahu la ilaha illa huwa, alayhi tawakkaltu wa huwa Rabbul-arshil-azim',
        translation: 'Allah is sufficient for me. There is none worthy of worship but Him. I have placed my trust in Him, He is Lord of the Majestic Throne. (Recite 7 times morning and evening.)',
        source: 'Abu Dawud 5081'
    },
    {
        id: 'morning-7',
        category: 'Morning & Evening',
        title: 'Health of Body, Hearing and Sight',
        arabic: 'اللَّهُمَّ عَافِنِي فِي بَدَنِي اللَّهُمَّ عَافِنِي فِي سَمْعِي اللَّهُمَّ عَافِنِي فِي بَصَرِي لَا إِلَهَ إِلَّا أَنْتَ',
        transliteration: 'Allahumma afini fi badani, Allahumma afini fi sam\'i, Allahumma afini fi basari, la ilaha illa ant',
        translation: 'O Allah, grant me health in my body. O Allah, grant me health in my hearing. O Allah, grant me health in my sight. There is none worthy of worship except You.',
        source: 'Abu Dawud 5090'
    },

    // ── Health & Healing ───────────────────────────────────────────────────────
    {
        id: 'health-2',
        category: 'Health',
        title: 'For Recovery from Illness',
        arabic: 'اللَّهُمَّ رَبَّ النَّاسِ أَذْهِبِ الْبَأْسَ اشْفِهِ أَنْتَ الشَّافِي لَا شِفَاءَ إِلَّا شِفَاؤُكَ شِفَاءً لَا يُغَادِرُ سَقَمًا',
        transliteration: 'Allahumma Rabban-nas, adhhibil-ba\'s, ishfihi antash-shafi, la shifa\'a illa shifa\'uk, shifa\'an la yughadiru saqama',
        translation: 'O Allah, Lord of mankind, remove the difficulty and grant cure. You are the Healer. There is no cure except Your cure — a cure that leaves no trace of illness.',
        source: 'Bukhari 5742 · Muslim 2191'
    },
    {
        id: 'health-3',
        category: 'Health',
        title: 'Visiting the Sick (×7)',
        arabic: 'أَسْأَلُ اللَّهَ الْعَظِيمَ رَبَّ الْعَرْشِ الْعَظِيمِ أَنْ يَشْفِيَكَ',
        transliteration: 'As\'alullaahal-\'Adheem, Rabbal-\'arshil-\'Adheem, an yashfiyak',
        translation: 'I ask Allah the Almighty, Lord of the Magnificent Throne, to cure you. (Recite 7 times when visiting a sick person — the Prophet ﷺ said they will recover unless their time has come.)',
        source: 'Abu Dawud 3106 · Tirmidhi 2083'
    },
    {
        id: 'health-4',
        category: 'Health',
        title: 'Ruqyah for Pain (×7)',
        arabic: 'أَعُوذُ بِعِزَّةِ اللَّهِ وَقُدْرَتِهِ مِنْ شَرِّ مَا أَجِدُ وَأُحَاذِرُ',
        transliteration: 'A\'udhu bi\'izzatillahi wa qudratihi min sharri ma ajidu wa uhadhir',
        translation: 'I seek refuge in Allah\'s might and power from the evil of what I find and fear. (Place your hand on the area of pain and recite 7 times.)',
        source: 'Muslim 2202'
    },
    {
        id: 'health-5',
        category: 'Health',
        title: 'Protection from Severe Illness',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْبَرَصِ وَالْجُنُونِ وَالْجُذَامِ وَمِنْ سَيِّئِ الْأَسْقَامِ',
        transliteration: 'Allahumma inni a\'udhu bika minal-barasi, wal-jununi, wal-judhami, wa min sayyi\'il-asqam',
        translation: 'O Allah, I seek Your protection from leprosy, madness, elephantiasis, and all evil diseases.',
        source: 'Abu Dawud 1554 · Nasai 5493'
    },
    {
        id: 'health-6',
        category: 'Health',
        title: 'When Afflicted with Illness',
        arabic: 'لَا بَأْسَ طَهُورٌ إِنْ شَاءَ اللَّهُ',
        transliteration: 'La ba\'s, tahurun in sha Allah',
        translation: 'No harm — it is a purification, if Allah wills. (The Prophet ﷺ said this to those who were ill, reminding them that sickness expiates sins.)',
        source: 'Bukhari 3616'
    },
    {
        id: 'health-7',
        category: 'Health',
        title: 'Comprehensive Well-Being Dua',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي',
        transliteration: 'Allahumma inni as\'alukal-afwa wal-afiyata fi dini wa dunyaya wa ahli wa mali',
        translation: 'O Allah, I ask You for pardon and well-being in my religion, my worldly life, my family, and my wealth.',
        source: 'Abu Dawud 5074 · Ibn Majah 3871'
    },

    // ── Gratitude ─────────────────────────────────────────────────────────────
    {
        id: 'gratitude-2',
        category: 'Gratitude',
        title: 'Dua of Sulayman — Gratitude for Blessings',
        arabic: 'رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ وَعَلَى وَالِدَيَّ وَأَنْ أَعْمَلَ صَالِحًا تَرْضَاهُ وَأَدْخِلْنِي بِرَحْمَتِكَ فِي عِبَادِكَ الصَّالِحِينَ',
        transliteration: 'Rabbi awzi\'ni an ashkura ni\'mataka allati an\'amta alayya wa ala walidayya wa an a\'mala salihan tardahu wa adkhilni birahmatika fi ibadika assaliheen',
        translation: 'My Lord, enable me to be grateful for Your favour which You have bestowed upon me and upon my parents, and to work righteousness of which You will approve, and admit me by Your mercy into the company of Your righteous servants.',
        source: 'An-Naml 27:19'
    },
    {
        id: 'gratitude-3',
        category: 'Gratitude',
        title: 'For Help in Remembrance and Thanks',
        arabic: 'اللَّهُمَّ أَعِنِّي عَلَى ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ',
        transliteration: 'Allahumma a\'inni ala dhikrika wa shukrika wa husni ibadatik',
        translation: 'O Allah, help me to remember You, to be grateful to You, and to worship You in a beautiful manner. (The Prophet ﷺ taught this to Muadh ibn Jabal and instructed him to say it after every prayer.)',
        source: 'Abu Dawud 1522 · Nasai 1303'
    },
    {
        id: 'gratitude-4',
        category: 'Gratitude',
        title: 'When a Blessing is Completed',
        arabic: 'الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ',
        transliteration: 'Alhamdu lillahil-ladhi bini\'matihi tatimmus-salihat',
        translation: 'All praise is for Allah, by Whose blessing good deeds are completed.',
        source: 'Ibn Majah 3803'
    },
    {
        id: 'gratitude-5',
        category: 'Gratitude',
        title: 'Gratitude After Good News',
        arabic: 'الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ وَالْحَمْدُ لِلَّهِ عَلَى كُلِّ حَالٍ',
        transliteration: 'Alhamdu lillahil-ladhi bini\'matihi tatimmus-salihat, wal-hamdu lillahi ala kulli hal',
        translation: 'All praise is for Allah, by Whose blessing good deeds are completed. And all praise is for Allah in every circumstance.',
        source: 'Ibn Majah 3803 · Ibn as-Sunni'
    },
    {
        id: 'gratitude-6',
        category: 'Gratitude',
        title: 'Dua of Ibrahim — Gratitude and Acceptance',
        arabic: 'رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنتَ السَّمِيعُ الْعَلِيمُ',
        transliteration: 'Rabbana taqabbal minna innaka antas-Sami\'ul-Alim',
        translation: 'Our Lord, accept from us. Indeed You are the All-Hearing, the All-Knowing.',
        source: 'Al-Baqarah 2:127'
    },

    // ── Success ───────────────────────────────────────────────────────────────
    {
        id: 'success-2',
        category: 'Success',
        title: 'For Easy Affairs',
        arabic: 'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا',
        transliteration: 'Allahumma la sahla illa ma ja\'altahu sahlan, wa anta taj\'alul-hazna idha shi\'ta sahla',
        translation: 'O Allah, nothing is easy except what You make easy, and You make the difficult easy if You wish.',
        source: 'Ibn Hibban — Sahih'
    },
    {
        id: 'success-3',
        category: 'Success',
        title: 'Dua of Musa Before a Task',
        arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِّن لِّسَانِي يَفْقَهُوا قَوْلِي',
        transliteration: 'Rabbi ishrah li sadri, wa yassir li amri, wahlul uqdatan min lisani, yafqahu qawli',
        translation: 'My Lord, expand my chest, ease my task, and untie the knot from my tongue so they may understand my speech.',
        source: 'Ta-Ha 20:25-28'
    },
    {
        id: 'success-4',
        category: 'Success',
        title: 'For Righteousness in All Matters',
        arabic: 'اللَّهُمَّ أَصْلِحْ لِي دِينِي الَّذِي هُوَ عِصْمَةُ أَمْرِي وَأَصْلِحْ لِي دُنْيَايَ الَّتِي فِيهَا مَعَاشِي وَأَصْلِحْ لِي آخِرَتِي الَّتِي فِيهَا مَعَادِي وَاجْعَلِ الْحَيَاةَ زِيَادَةً لِي فِي كُلِّ خَيْرٍ وَاجْعَلِ الْمَوْتَ رَاحَةً لِي مِنْ كُلِّ شَرٍّ',
        transliteration: 'Allahumma aslih li diniyal-ladhi huwa \'ismatu amri, wa aslih li dunyayal-lati fiha ma\'ashi, wa aslih li akhiratiyal-lati fiha ma\'adi, waj\'alil-hayata ziyadatan li fi kulli khayr, waj\'alil-mawta rahatan li min kulli sharr',
        translation: 'O Allah, set right my religion which is the safeguard of my affairs. Set right my worldly life in which is my livelihood. Set right my Hereafter to which is my return. Make life an addition for me in every good, and make death a rest for me from every evil.',
        source: 'Muslim 2720'
    },
    {
        id: 'success-5',
        category: 'Success',
        title: 'Seeking Allah\'s Choice in Decisions',
        arabic: 'اللَّهُمَّ خِرْ لِي وَاخْتَرْ لِي',
        transliteration: 'Allahumma khir li wakhtar li',
        translation: 'O Allah, choose what is good for me and choose for me.',
        source: 'Tirmidhi 3516'
    },
    {
        id: 'success-6',
        category: 'Success',
        title: 'For Barakah in Time and Efforts',
        arabic: 'اللَّهُمَّ بَارِكْ لَنَا فِيمَا رَزَقْتَنَا وَقِنَا عَذَابَ النَّارِ',
        transliteration: 'Allahumma barik lana fima razaqtana wa qina \'adhaban-nar',
        translation: 'O Allah, bless us in what You have provided for us and protect us from the punishment of the Fire.',
        source: 'Ibn as-Sunni — Authenticated'
    },

    // ── Anxiety & Distress ────────────────────────────────────────────────────
    {
        id: 'anxiety-3',
        category: 'Anxiety',
        title: 'The Great Dua for Grief and Worry',
        arabic: 'اللَّهُمَّ إِنِّي عَبْدُكَ ابْنُ عَبْدِكَ ابْنُ أَمَتِكَ نَاصِيَتِي بِيَدِكَ مَاضٍ فِيَّ حُكْمُكَ عَدْلٌ فِيَّ قَضَاؤُكَ أَسْأَلُكَ بِكُلِّ اسْمٍ هُوَ لَكَ سَمَّيْتَ بِهِ نَفْسَكَ أَوْ أَنْزَلْتَهُ فِي كِتَابِكَ أَنْ تَجْعَلَ الْقُرْآنَ رَبِيعَ قَلْبِي وَنُورَ صَدْرِي وَجَلَاءَ حُزْنِي وَذَهَابَ هَمِّي',
        transliteration: 'Allahumma inni abduka, ibnu abdika, ibnu amatika, nasiyati biyadika, madin fiyya hukmuka, adlun fiyya qada\'uka, as\'aluka bi kulli ismin huwa laka, an taj\'alal-Qur\'ana rabi\'a qalbi wa nura sadri wa jala\'a huzni wa dhahaba hammi',
        translation: 'O Allah, I am Your servant, son of Your servant, son of Your female servant. My forelock is in Your hand. Your decree upon me is certain, Your judgment is just. I ask You by every name You have given Yourself — to make the Quran the spring of my heart, the light of my chest, the departure of my grief, and the removal of my anxiety. (The Prophet ﷺ said: Allah will remove his grief and replace it with joy.)',
        source: 'Ahmad 3712 — Sahih'
    },
    {
        id: 'anxiety-4',
        category: 'Anxiety',
        title: 'Dua of Yunus in the Darkness',
        arabic: 'لَا إِلَهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ',
        transliteration: 'La ilaha illa anta subhanaka inni kuntu minaz-zalimin',
        translation: 'There is none worthy of worship except You. Glory be to You. Indeed I have been of the wrongdoers. (Yunus ﷺ said this in the belly of the whale. The Prophet ﷺ said: No Muslim supplicates with it about any matter except Allah will respond to him.)',
        source: 'Al-Anbiya 21:87 · Tirmidhi 3505'
    },
    {
        id: 'anxiety-5',
        category: 'Anxiety',
        title: 'For Distress and Hardship',
        arabic: 'لَا إِلَهَ إِلَّا اللَّهُ الْعَظِيمُ الْحَلِيمُ لَا إِلَهَ إِلَّا اللَّهُ رَبُّ الْعَرْشِ الْعَظِيمِ لَا إِلَهَ إِلَّا اللَّهُ رَبُّ السَّمَوَاتِ وَرَبُّ الْأَرْضِ وَرَبُّ الْعَرْشِ الْكَرِيمِ',
        transliteration: 'La ilaha illallahul-adhimul-halim, la ilaha illallahu Rabbul-arshil-azim, la ilaha illallahu Rabbus-samawati wa Rabbul-ardi wa Rabbul-arshil-karim',
        translation: 'There is none worthy of worship except Allah, the Magnificent, the Forbearing. There is none worthy of worship except Allah, Lord of the Magnificent Throne. There is none worthy of worship except Allah, Lord of the heavens, Lord of the earth, and Lord of the Noble Throne.',
        source: 'Bukhari 6346 · Muslim 2730'
    },
    {
        id: 'anxiety-6',
        category: 'Anxiety',
        title: 'Trusting Allah Completely',
        arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
        transliteration: 'Hasbunallahu wa ni\'mal-wakil',
        translation: 'Allah is sufficient for us and He is the best Disposer of affairs. (The Prophet Ibrahim ﷺ said this when thrown into the fire; the Prophet Muhammad ﷺ said this at the Battle of Uhud.)',
        source: 'Al-Imran 3:173 · Bukhari 4563'
    },

    // ── Knowledge ─────────────────────────────────────────────────────────────
    {
        id: 'knowledge-3',
        category: 'Knowledge',
        title: 'For Increase in Knowledge (Quranic)',
        arabic: 'رَّبِّ زِدْنِي عِلْمًا',
        transliteration: 'Rabbi zidni ilma',
        translation: 'My Lord, increase me in knowledge. (The only dua in the Quran where Allah commands the Prophet ﷺ to ask for increase in something.)',
        source: 'Ta-Ha 20:114'
    },
    {
        id: 'knowledge-4',
        category: 'Knowledge',
        title: 'For Beneficial Knowledge and Good Provision',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا طَيِّبًا وَعَمَلًا مُتَقَبَّلًا',
        transliteration: 'Allahumma inni as\'aluka ilman nafi\'an, wa rizqan tayyiban, wa amalan mutaqabbala',
        translation: 'O Allah, I ask You for knowledge that is beneficial, provisions that are pure, and actions that are accepted.',
        source: 'Ibn Majah 925'
    },
    {
        id: 'knowledge-5',
        category: 'Knowledge',
        title: 'For Benefit from Knowledge Learned',
        arabic: 'اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي وَعَلِّمْنِي مَا يَنْفَعُنِي وَزِدْنِي عِلْمًا',
        transliteration: 'Allahummanfa\'ni bima allamtani, wa allimni ma yanfa\'uni, wa zidni ilma',
        translation: 'O Allah, benefit me with what You have taught me, teach me what will benefit me, and increase me in knowledge.',
        source: 'Tirmidhi 3599 · Ibn Majah 251'
    },
    {
        id: 'knowledge-6',
        category: 'Knowledge',
        title: 'For Protection from Harmful Knowledge',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عِلْمٍ لَا يَنْفَعُ وَمِنْ قَلْبٍ لَا يَخْشَعُ وَمِنْ نَفْسٍ لَا تَشْبَعُ وَمِنْ دَعْوَةٍ لَا يُسْتَجَابُ لَهَا',
        transliteration: 'Allahumma inni a\'udhu bika min ilmin la yanfa\', wa min qalbin la yakhsha\', wa min nafsin la tashba\', wa min da\'watin la yustajabu laha',
        translation: 'O Allah, I seek refuge in You from knowledge that does not benefit, from a heart that does not humble itself, from a soul that is never satisfied, and from a supplication that is not answered.',
        source: 'Muslim 2722 · Nasai 5444'
    },

    // ── Evil Eye ──────────────────────────────────────────────────────────────
    {
        id: 'evil-eye-3',
        category: 'Evil Eye',
        title: 'Surah Al-Falaq — Protection from Envy',
        arabic: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ مِن شَرِّ مَا خَلَقَ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
        transliteration: 'Qul a\'udhu bi Rabbil-falaq, min sharri ma khalaq, wa min sharri ghasiqin idha waqab, wa min sharrin-naffathati fil-\'uqad, wa min sharri hasidin idha hasad',
        translation: 'Say: I seek refuge with the Lord of the daybreak, from the evil of that which He created, from the evil of the darkening night, from the evil of those who blow in knots, and from the evil of the envier when he envies.',
        source: 'Al-Falaq 113:1-5'
    },
    {
        id: 'evil-eye-4',
        category: 'Evil Eye',
        title: 'Protecting Children from the Evil Eye',
        arabic: 'أُعِيذُكَ بِكَلِمَاتِ اللَّهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ',
        transliteration: 'U\'idhuka bi kalimatillahit-tammati min kulli shaytanin wa hammatin wa min kulli aynin lammah',
        translation: 'I seek protection for you in Allah\'s perfect words from every devil, every poisonous creature, and every evil eye. (The Prophet ﷺ used this for al-Hasan and al-Husayn.)',
        source: 'Bukhari 3371'
    },
    {
        id: 'evil-eye-5',
        category: 'Evil Eye',
        title: 'When Admiring Something — Preventing the Evil Eye',
        arabic: 'اللَّهُمَّ بَارِكْ عَلَيْهِ',
        transliteration: 'Allahumma barik alayh',
        translation: 'O Allah, bless him/her/it. (Say this when admiring something belonging to someone else, to prevent causing them harm by your gaze.)',
        source: 'Abu Dawud 3929'
    },
    {
        id: 'evil-eye-6',
        category: 'Evil Eye',
        title: 'Ruqyah for Removing the Evil Eye',
        arabic: 'بِسْمِ اللَّهِ أَرْقِيكَ مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ اللَّهُ يَشْفِيكَ بِسْمِ اللَّهِ أَرْقِيكَ',
        transliteration: 'Bismillahi arqika, min kulli shay\'in yu\'dhika, min sharri kulli nafsin aw ayni hasidin, Allahu yashfika, bismillahi arqika',
        translation: 'In the name of Allah I perform ruqyah for you, from everything that harms you, from the evil of every soul or envious eye. May Allah heal you. In the name of Allah I perform ruqyah for you.',
        source: 'Muslim 2186'
    },

    // ── Protection ────────────────────────────────────────────────────────────
    {
        id: 'protection-3',
        category: 'Protection',
        title: 'Comprehensive Protection from All Evil',
        arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ',
        transliteration: 'A\'udhu bikalimatillahit-tammati min sharri ma khalaq',
        translation: 'I seek refuge in Allah\'s perfect words from the evil of what He has created. (Whoever says this 3 times in the evening will not be harmed by any venom that night.)',
        source: 'Muslim 2708 · Tirmidhi 3604'
    },
    {
        id: 'protection-4',
        category: 'Protection',
        title: 'Protection at Dawn and Dusk',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي',
        transliteration: 'Allahumma inni as\'alukal-afiyata fid-dunya wal-akhirah, Allahumma inni as\'alukal-afwa wal-afiyata fi dini wa dunyaya wa ahli wa mali',
        translation: 'O Allah, I ask You for well-being in this world and the next. O Allah, I ask You for pardon and well-being in my religion, my worldly affairs, my family, and my wealth.',
        source: 'Ibn Majah 3871 · Abu Dawud 5074'
    },
    {
        id: 'protection-5',
        category: 'Protection',
        title: 'Entering a New Place or Town',
        arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ وَبَرَأَ وَذَرَأَ وَمِنْ شَرِّ مَا يَنْزِلُ مِنَ السَّمَاءِ وَمِنْ شَرِّ كُلِّ طَارِقٍ إِلَّا طَارِقًا يَطْرُقُ بِخَيْرٍ يَا رَحْمَنُ',
        transliteration: 'A\'udhu bikalimatillahit-tammati min sharri ma khalaqa wa bara\'a wa dhara\'a, wa min sharri ma yanzilu minas-sama\'i, wa min sharri kulli tariqin illa tariqan yatruqu bi khayrin ya Rahman',
        translation: 'I seek refuge in Allah\'s perfect words from the evil of what He created, from the evil of what descends from the sky, and from the visits of the night except for a visitor that comes with goodness. O Most Merciful!',
        source: 'Ahmad 15463 — Sahih'
    },
    {
        id: 'protection-6',
        category: 'Protection',
        title: 'Dua in the Marketplace',
        arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ يُحْيِي وَيُمِيتُ وَهُوَ حَيٌّ لَا يَمُوتُ بِيَدِهِ الْخَيْرُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
        transliteration: 'La ilaha illallahu wahdahu la sharika lahu, lahul-mulku wa lahul-hamdu yuhyi wa yumitu wa huwa hayyun la yamutu biyadihil-khayru wa huwa ala kulli shay\'in qadir',
        translation: 'There is none worthy of worship except Allah, alone without partner. To Him belongs dominion and praise. He gives life and causes death, and He is Ever-Living and will never die. In His hand is all goodness, and He is over all things powerful. (Recite when entering the marketplace.)',
        source: 'Tirmidhi 3428 — Sahih'
    },
    {
        id: 'protection-7',
        category: 'Protection',
        title: 'Before Sleeping — Protection Through the Night',
        arabic: 'بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي وَبِكَ أَرْفَعُهُ فَإِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ',
        transliteration: 'Bismika Rabbi wada\'tu janbi wa bika arfa\'uhu, fa\'in amsakta nafsi farhamha, wa in arsaltaha fahfadha bima tahfadhu bihi ibadakas-salihin',
        translation: 'In Your name my Lord I lie down, and in Your name I rise. If You take my soul, then have mercy on it. And if You release it, then protect it as You protect Your righteous servants.',
        source: 'Bukhari 6320 · Muslim 2714'
    },

    // ── Exams & Study (Hisnul Muslim + Quranic duas) ──
    {
        id: 'exam-1',
        category: 'Exams & Study',
        title: 'Before an Exam — Dua of Musa',
        arabic: 'رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِّن لِّسَانِي يَفْقَهُوا قَوْلِي',
        transliteration: 'Rabbish-rah li sadri, wa yassir li amri, wahlul uqdatan min lisani, yafqahu qawli',
        translation: 'My Lord, expand for me my chest, ease my task for me, and untie the knot from my tongue so they may understand my speech.',
        source: 'Quran 20:25-28'
    },
    {
        id: 'exam-2',
        category: 'Exams & Study',
        title: 'Nothing Is Easy Except What You Make Easy',
        arabic: 'اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا وَأَنْتَ تَجْعَلُ الْحَزْنَ إِذَا شِئْتَ سَهْلًا',
        transliteration: 'Allahumma la sahla illa ma ja\'altahu sahlan, wa anta taj\'alul-hazna idha shi\'ta sahlan',
        translation: 'O Allah, there is no ease except in what You have made easy, and You make the difficult easy when You will.',
        source: 'Ibn Hibban 974 — Sahih'
    },
    {
        id: 'exam-3',
        category: 'Exams & Study',
        title: 'Before Studying — For Beneficial Learning',
        arabic: 'اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي وَعَلِّمْنِي مَا يَنْفَعُنِي وَزِدْنِي عِلْمًا',
        transliteration: 'Allahumma-nfa\'ni bima allamtani, wa allimni ma yanfa\'uni, wa zidni ilma',
        translation: 'O Allah, benefit me with what You have taught me, teach me what will benefit me, and increase me in knowledge.',
        source: 'Tirmidhi 3599 · Ibn Majah 251'
    },
    {
        id: 'exam-4',
        category: 'Exams & Study',
        title: 'When the Exam Feels Too Big',
        arabic: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
        transliteration: 'Hasbunallahu wa ni\'mal-wakil',
        translation: 'Allah is sufficient for us, and He is the best Disposer of affairs.',
        source: 'Quran 3:173 · Bukhari 4563'
    },
    {
        id: 'exam-5',
        category: 'Exams & Study',
        title: 'For a Right Outcome in Your Effort',
        arabic: 'رَبَّنَا آتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا',
        transliteration: 'Rabbana atina min ladunka rahmatan wa hayyi\' lana min amrina rashada',
        translation: 'Our Lord, grant us mercy from Yourself and arrange for us right guidance in our affair.',
        source: 'Quran 18:10'
    },
    {
        id: 'exam-6',
        category: 'Exams & Study',
        title: 'Walking into the Exam Hall — Reliance on Allah',
        arabic: 'بِسْمِ اللَّهِ تَوَكَّلْتُ عَلَى اللَّهِ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
        transliteration: 'Bismillahi tawakkaltu alallahi, wa la hawla wa la quwwata illa billah',
        translation: 'In the name of Allah, I place my trust in Allah, and there is no might nor power except with Allah.',
        source: 'Abu Dawud 5095 · Tirmidhi 3426'
    },
    {
        id: 'exam-7',
        category: 'Exams & Study',
        title: 'After the Exam — Gratitude and Acceptance',
        arabic: 'الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ',
        transliteration: 'Alhamdu lillahil-ladhi bini\'matihi tatimmus-salihat',
        translation: 'All praise is for Allah by whose favour good deeds are completed.',
        source: 'Ibn Majah 3803 — Sahih'
    },

    // ── Work & Career ──
    {
        id: 'work-1',
        category: 'Work & Career',
        title: 'Seeking a Job — Dua of Musa',
        arabic: 'رَبِّ إِنِّي لِمَا أَنزَلْتَ إِلَيَّ مِنْ خَيْرٍ فَقِيرٌ',
        transliteration: 'Rabbi inni lima anzalta ilayya min khayrin faqir',
        translation: 'My Lord, I am in absolute need of whatever good You send down to me. (Musa made this dua as a stranger with nothing — and was soon given work, a home, and a family.)',
        source: 'Quran 28:24'
    },
    {
        id: 'work-2',
        category: 'Work & Career',
        title: 'Freedom from Debt and Need of Others',
        arabic: 'اللَّهُمَّ اكْفِنِي بِحَلَالِكَ عَنْ حَرَامِكَ وَأَغْنِنِي بِفَضْلِكَ عَمَّنْ سِوَاكَ',
        transliteration: 'Allahumma-kfini bihalalika an haramika, wa aghnini bifadlika amman siwak',
        translation: 'O Allah, suffice me with what You have made lawful instead of what You have made unlawful, and make me independent of all besides You by Your bounty.',
        source: 'Tirmidhi 3563 — Hasan'
    },
    {
        id: 'work-3',
        category: 'Work & Career',
        title: 'Barakah in the Early Hours',
        arabic: 'اللَّهُمَّ بَارِكْ لِأُمَّتِي فِي بُكُورِهَا',
        transliteration: 'Allahumma barik li-ummati fi bukuriha',
        translation: 'O Allah, bless my ummah in its early mornings. (The Prophet ﷺ made this dua — start your work early to enter into it.)',
        source: 'Abu Dawud 2606 · Tirmidhi 1212'
    },
    {
        id: 'work-4',
        category: 'Work & Career',
        title: 'For Wisdom in Responsibility',
        arabic: 'رَبِّ هَبْ لِي حُكْمًا وَأَلْحِقْنِي بِالصَّالِحِينَ',
        transliteration: 'Rabbi hab li hukman wa alhiqni bis-salihin',
        translation: 'My Lord, grant me sound judgement, and join me with the righteous.',
        source: 'Quran 26:83'
    },
    {
        id: 'work-5',
        category: 'Work & Career',
        title: 'Success Comes Only from Allah',
        arabic: 'وَمَا تَوْفِيقِي إِلَّا بِاللَّهِ عَلَيْهِ تَوَكَّلْتُ وَإِلَيْهِ أُنِيبُ',
        transliteration: 'Wa ma tawfiqi illa billah, alayhi tawakkaltu wa ilayhi unib',
        translation: 'My success is only through Allah. Upon Him I rely, and to Him I turn.',
        source: 'Quran 11:88'
    },

    // ── Weather & Nature (Hisnul Muslim) ──
    {
        id: 'weather-1',
        category: 'Weather & Nature',
        title: 'When It Rains',
        arabic: 'اللَّهُمَّ صَيِّبًا نَافِعًا',
        transliteration: 'Allahumma sayyiban nafi\'a',
        translation: 'O Allah, make it a beneficial rain. (Rainfall is also a time when duas are answered.)',
        source: 'Bukhari 1032'
    },
    {
        id: 'weather-2',
        category: 'Weather & Nature',
        title: 'After Rainfall',
        arabic: 'مُطِرْنَا بِفَضْلِ اللَّهِ وَرَحْمَتِهِ',
        transliteration: 'Mutirna bifadlillahi wa rahmatih',
        translation: 'We have been given rain by the grace and mercy of Allah.',
        source: 'Bukhari 846 · Muslim 71'
    },
    {
        id: 'weather-3',
        category: 'Weather & Nature',
        title: 'When Hearing Thunder',
        arabic: 'سُبْحَانَ الَّذِي يُسَبِّحُ الرَّعْدُ بِحَمْدِهِ وَالْمَلَائِكَةُ مِنْ خِيفَتِهِ',
        transliteration: 'Subhanal-ladhi yusabbihur-ra\'du bihamdihi wal-mala\'ikatu min khifatih',
        translation: 'Glory be to Him whom the thunder glorifies with His praise, and the angels out of awe of Him.',
        source: 'Muwatta Malik 1839'
    },
    {
        id: 'weather-4',
        category: 'Weather & Nature',
        title: 'During Strong Wind',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَهَا وَخَيْرَ مَا فِيهَا وَخَيْرَ مَا أُرْسِلَتْ بِهِ وَأَعُوذُ بِكَ مِنْ شَرِّهَا وَشَرِّ مَا فِيهَا وَشَرِّ مَا أُرْسِلَتْ بِهِ',
        transliteration: 'Allahumma inni as\'aluka khayraha wa khayra ma fiha wa khayra ma ursilat bih, wa a\'udhu bika min sharriha wa sharri ma fiha wa sharri ma ursilat bih',
        translation: 'O Allah, I ask You for its good, the good within it, and the good it was sent with. And I seek refuge in You from its evil, the evil within it, and the evil it was sent with.',
        source: 'Muslim 899'
    },
    {
        id: 'weather-5',
        category: 'Weather & Nature',
        title: 'Asking Allah for Rain in Drought (Istisqa)',
        arabic: 'اللَّهُمَّ أَغِثْنَا اللَّهُمَّ أَغِثْنَا اللَّهُمَّ أَغِثْنَا',
        transliteration: 'Allahumma aghithna, Allahumma aghithna, Allahumma aghithna',
        translation: 'O Allah, send us relief. O Allah, send us relief. O Allah, send us relief.',
        source: 'Bukhari 1014 · Muslim 897'
    },
    {
        id: 'weather-6',
        category: 'Weather & Nature',
        title: 'Sighting the New Moon',
        arabic: 'اللَّهُمَّ أَهِلَّهُ عَلَيْنَا بِالْأَمْنِ وَالْإِيمَانِ وَالسَّلَامَةِ وَالْإِسْلَامِ رَبِّي وَرَبُّكَ اللَّهُ',
        transliteration: 'Allahumma ahillahu alayna bil-amni wal-imani was-salamati wal-islam, rabbi wa rabbukallah',
        translation: 'O Allah, bring this moon over us with security, faith, safety and Islam. My Lord and your Lord is Allah.',
        source: 'Tirmidhi 3451 — Sahih'
    },

    // ── Patience & Anger (Hisnul Muslim) ──
    {
        id: 'patience-1',
        category: 'Patience & Anger',
        title: 'When Anger Rises',
        arabic: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
        transliteration: 'A\'udhu billahi minash-shaytanir-rajim',
        translation: 'I seek refuge in Allah from Shaytan, the accursed. (The Prophet ﷺ said: if an angry person says this, his anger will leave him.)',
        source: 'Bukhari 6115 · Muslim 2610'
    },
    {
        id: 'patience-2',
        category: 'Patience & Anger',
        title: 'To Be Poured Over with Patience',
        arabic: 'رَبَّنَا أَفْرِغْ عَلَيْنَا صَبْرًا وَثَبِّتْ أَقْدَامَنَا وَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ',
        transliteration: 'Rabbana afrigh alayna sabran wa thabbit aqdamana wansurna alal-qawmil-kafirin',
        translation: 'Our Lord, pour patience over us, make our feet firm, and give us victory over the disbelieving people.',
        source: 'Quran 2:250'
    },
    {
        id: 'patience-3',
        category: 'Patience & Anger',
        title: 'The Patience of Ayyub in Long Hardship',
        arabic: 'رَبِّ أَنِّي مَسَّنِيَ الضُّرُّ وَأَنتَ أَرْحَمُ الرَّاحِمِينَ',
        transliteration: 'Rabbi anni massaniyad-durru wa anta arhamur-rahimin',
        translation: 'My Lord, adversity has touched me, and You are the Most Merciful of the merciful. (The dua of Ayyub after years of illness — and Allah restored everything he had lost.)',
        source: 'Quran 21:83'
    },
    {
        id: 'patience-4',
        category: 'Patience & Anger',
        title: 'Removing Grudges from the Heart',
        arabic: 'رَبَّنَا اغْفِرْ لَنَا وَلِإِخْوَانِنَا الَّذِينَ سَبَقُونَا بِالْإِيمَانِ وَلَا تَجْعَلْ فِي قُلُوبِنَا غِلًّا لِّلَّذِينَ آمَنُوا رَبَّنَا إِنَّكَ رَءُوفٌ رَّحِيمٌ',
        transliteration: 'Rabbana-ghfir lana wa li-ikhwaninal-ladhina sabaquna bil-imani wa la taj\'al fi qulubina ghillan lilladhina amanu, Rabbana innaka ra\'ufun rahim',
        translation: 'Our Lord, forgive us and our brothers who preceded us in faith, and put no rancour in our hearts toward those who believe. Our Lord, You are Kind and Merciful.',
        source: 'Quran 59:10'
    },
    {
        id: 'patience-5',
        category: 'Patience & Anger',
        title: 'From the Evil of My Own Tongue',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ شَرِّ سَمْعِي وَمِنْ شَرِّ بَصَرِي وَمِنْ شَرِّ لِسَانِي وَمِنْ شَرِّ قَلْبِي وَمِنْ شَرِّ مَنِيِّي',
        transliteration: 'Allahumma inni a\'udhu bika min sharri sam\'i, wa min sharri basari, wa min sharri lisani, wa min sharri qalbi, wa min sharri maniyyi',
        translation: 'O Allah, I seek refuge in You from the evil of my hearing, the evil of my sight, the evil of my tongue, the evil of my heart, and the evil of my desires.',
        source: 'Abu Dawud 1551 · Tirmidhi 3492'
    },

    // ── Daily Routine additions (Hisnul Muslim) ──
    {
        id: 'daily-mosque-1',
        category: 'Daily Routine',
        title: 'Entering the Mosque',
        arabic: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
        transliteration: 'Allahumma-ftah li abwaba rahmatik',
        translation: 'O Allah, open for me the doors of Your mercy.',
        source: 'Muslim 713'
    },
    {
        id: 'daily-mosque-2',
        category: 'Daily Routine',
        title: 'Leaving the Mosque',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنْ فَضْلِكَ',
        transliteration: 'Allahumma inni as\'aluka min fadlik',
        translation: 'O Allah, I ask You from Your bounty.',
        source: 'Muslim 713'
    },
    {
        id: 'daily-clothes-1',
        category: 'Daily Routine',
        title: 'Wearing New Clothes',
        arabic: 'اللَّهُمَّ لَكَ الْحَمْدُ أَنْتَ كَسَوْتَنِيهِ أَسْأَلُكَ مِنْ خَيْرِهِ وَخَيْرِ مَا صُنِعَ لَهُ وَأَعُوذُ بِكَ مِنْ شَرِّهِ وَشَرِّ مَا صُنِعَ لَهُ',
        transliteration: 'Allahumma lakal-hamdu anta kasawtanih, as\'aluka min khayrihi wa khayri ma suni\'a lah, wa a\'udhu bika min sharrihi wa sharri ma suni\'a lah',
        translation: 'O Allah, to You is all praise — You have clothed me with it. I ask You for its good and the good of what it was made for, and I seek refuge in You from its evil and the evil of what it was made for.',
        source: 'Abu Dawud 4020 · Tirmidhi 1767'
    },
    {
        id: 'daily-sneeze-1',
        category: 'Daily Routine',
        title: 'When Sneezing (and the Reply)',
        arabic: 'الْحَمْدُ لِلَّهِ — يَرْحَمُكَ اللَّهُ — يَهْدِيكُمُ اللَّهُ وَيُصْلِحُ بَالَكُمْ',
        transliteration: 'Alhamdulillah — Yarhamukallah — Yahdikumullahu wa yuslihu balakum',
        translation: 'The sneezer says: All praise is for Allah. The listener replies: May Allah have mercy on you. The sneezer responds: May Allah guide you and set your affairs right.',
        source: 'Bukhari 6224'
    },
    {
        id: 'daily-gathering-1',
        category: 'Daily Routine',
        title: 'Leaving a Gathering (Kaffarat al-Majlis)',
        arabic: 'سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ أَشْهَدُ أَنْ لَا إِلَهَ إِلَّا أَنْتَ أَسْتَغْفِرُكَ وَأَتُوبُ إِلَيْكَ',
        transliteration: 'Subhanakallahumma wa bihamdika ash-hadu an la ilaha illa anta astaghfiruka wa atubu ilayk',
        translation: 'Glory be to You O Allah, and praise. I bear witness that there is no deity except You. I seek Your forgiveness and turn to You in repentance. (Erases the mistakes made in that gathering.)',
        source: 'Tirmidhi 3433 — Sahih'
    },

    // ── Family additions ──
    {
        id: 'family-newborn-1',
        category: 'Family',
        title: 'Congratulating Parents of a Newborn',
        arabic: 'بَارَكَ اللَّهُ لَكَ فِي الْمَوْهُوبِ لَكَ وَشَكَرْتَ الْوَاهِبَ وَبَلَغَ أَشُدَّهُ وَرُزِقْتَ بِرَّهُ',
        transliteration: 'Barakallahu laka fil-mawhubi lak, wa shakartal-wahib, wa balagha ashuddahu, wa ruziqta birrah',
        translation: 'May Allah bless you in what He has gifted you, may you give thanks to the Giver, may the child reach full maturity, and may you be granted its righteousness toward you.',
        source: 'Reported from al-Hasan al-Basri — an-Nawawi, al-Adhkar'
    },

    // ── Tahajjud & Night (the Prophet's ﷺ own night-prayer duas) ──
    {
        id: 'night-1',
        category: 'Tahajjud & Night',
        title: 'Opening Dua of Tahajjud',
        arabic: 'اللَّهُمَّ لَكَ الْحَمْدُ أَنْتَ قَيِّمُ السَّمَاوَاتِ وَالْأَرْضِ وَمَنْ فِيهِنَّ وَلَكَ الْحَمْدُ لَكَ مُلْكُ السَّمَاوَاتِ وَالْأَرْضِ وَمَنْ فِيهِنَّ وَلَكَ الْحَمْدُ أَنْتَ نُورُ السَّمَاوَاتِ وَالْأَرْضِ وَلَكَ الْحَمْدُ أَنْتَ الْحَقُّ وَوَعْدُكَ الْحَقُّ',
        transliteration: 'Allahumma lakal-hamdu anta qayyimus-samawati wal-ardi wa man fihinn, wa lakal-hamdu laka mulkus-samawati wal-ardi wa man fihinn, wa lakal-hamdu anta nurus-samawati wal-ard, wa lakal-hamdu antal-haqqu wa wa\'dukal-haqq',
        translation: 'O Allah, to You belongs all praise — You are the Sustainer of the heavens and the earth and all within them. To You belongs all praise — Yours is the dominion of the heavens and the earth and all within them. To You belongs all praise — You are the Light of the heavens and the earth. To You belongs all praise — You are the Truth and Your promise is true. (How the Prophet ﷺ opened his tahajjud.)',
        source: 'Bukhari 1120'
    },
    {
        id: 'night-2',
        category: 'Tahajjud & Night',
        title: 'Waking in the Night — A Dua That Is Answered',
        arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ الْحَمْدُ لِلَّهِ وَسُبْحَانَ اللَّهِ وَلَا إِلَهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
        transliteration: 'La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ala kulli shay\'in qadir. Alhamdulillah, wa subhanallah, wa la ilaha illallah, wallahu akbar, wa la hawla wa la quwwata illa billah',
        translation: 'There is no deity except Allah alone, without partner. His is the dominion and His is the praise, and He is over all things powerful. Praise be to Allah, glory be to Allah, there is no deity except Allah, Allah is the Greatest, and there is no might nor power except with Allah. (Whoever wakes at night and says this, then asks forgiveness or makes dua — it is answered.)',
        source: 'Bukhari 1154'
    },
    {
        id: 'night-3',
        category: 'Tahajjud & Night',
        title: 'In Sujood — The Closest You Are to Allah',
        arabic: 'اللَّهُمَّ اغْفِرْ لِي ذَنْبِي كُلَّهُ دِقَّهُ وَجِلَّهُ وَأَوَّلَهُ وَآخِرَهُ وَعَلَانِيَتَهُ وَسِرَّهُ',
        transliteration: 'Allahumma-ghfir li dhanbi kullah, diqqahu wa jillah, wa awwalahu wa akhirah, wa alaniyatahu wa sirrah',
        translation: 'O Allah, forgive me all of my sins — the small and the great, the first and the last, the open and the hidden. (Said by the Prophet ﷺ in sujood; the servant is nearest to his Lord while prostrating, so make abundant dua there.)',
        source: 'Muslim 483'
    },
    {
        id: 'night-4',
        category: 'Tahajjud & Night',
        title: 'After Witr',
        arabic: 'سُبْحَانَ الْمَلِكِ الْقُدُّوسِ سُبْحَانَ الْمَلِكِ الْقُدُّوسِ سُبْحَانَ الْمَلِكِ الْقُدُّوسِ',
        transliteration: 'Subhanal-malikil-quddus, subhanal-malikil-quddus, subhanal-malikil-quddus',
        translation: 'Glory be to the King, the Most Holy. (Three times, raising the voice on the third — the Prophet\'s ﷺ words after completing witr.)',
        source: 'Abu Dawud 1430 · an-Nasa\'i 1732'
    },
    {
        id: 'night-5',
        category: 'Tahajjud & Night',
        title: 'The Dua for Light',
        arabic: 'اللَّهُمَّ اجْعَلْ فِي قَلْبِي نُورًا وَفِي بَصَرِي نُورًا وَفِي سَمْعِي نُورًا وَعَنْ يَمِينِي نُورًا وَعَنْ يَسَارِي نُورًا وَفَوْقِي نُورًا وَتَحْتِي نُورًا وَأَمَامِي نُورًا وَخَلْفِي نُورًا وَاجْعَلْ لِي نُورًا',
        transliteration: 'Allahumma-j\'al fi qalbi nura, wa fi basari nura, wa fi sam\'i nura, wa an yamini nura, wa an yasari nura, wa fawqi nura, wa tahti nura, wa amami nura, wa khalfi nura, waj\'al li nura',
        translation: 'O Allah, place light in my heart, light in my sight, light in my hearing, light on my right, light on my left, light above me, light below me, light in front of me, light behind me — and make for me light. (Made by the Prophet ﷺ walking to the night prayer in the dark.)',
        source: 'Bukhari 6316 · Muslim 763'
    },
    {
        id: 'night-6',
        category: 'Tahajjud & Night',
        title: 'Asking for All the Good the Prophet ﷺ Asked For',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ مِنَ الْخَيْرِ كُلِّهِ عَاجِلِهِ وَآجِلِهِ مَا عَلِمْتُ مِنْهُ وَمَا لَمْ أَعْلَمْ وَأَعُوذُ بِكَ مِنَ الشَّرِّ كُلِّهِ عَاجِلِهِ وَآجِلِهِ مَا عَلِمْتُ مِنْهُ وَمَا لَمْ أَعْلَمْ',
        transliteration: 'Allahumma inni as\'aluka minal-khayri kullihi ajilihi wa ajilih, ma alimtu minhu wa ma lam a\'lam, wa a\'udhu bika minash-sharri kullihi ajilihi wa ajilih, ma alimtu minhu wa ma lam a\'lam',
        translation: 'O Allah, I ask You for all good — the immediate and the deferred, what I know of it and what I do not know. And I seek refuge in You from all evil — the immediate and the deferred, what I know of it and what I do not know.',
        source: 'Ibn Majah 3846 — Sahih'
    },
    {
        id: 'night-7',
        category: 'Tahajjud & Night',
        title: 'Lying Down on Your Right Side',
        arabic: 'اللَّهُمَّ قِنِي عَذَابَكَ يَوْمَ تَبْعَثُ عِبَادَكَ',
        transliteration: 'Allahumma qini adhabaka yawma tab\'athu ibadak',
        translation: 'O Allah, protect me from Your punishment on the Day You resurrect Your servants. (Said with the right hand under the cheek when lying down to sleep.)',
        source: 'Abu Dawud 5045 · Tirmidhi 3398'
    },

    // ── Hajj & Umrah ──
    {
        id: 'hajj-1',
        category: 'Hajj & Umrah',
        title: 'The Talbiyah',
        arabic: 'لَبَّيْكَ اللَّهُمَّ لَبَّيْكَ لَبَّيْكَ لَا شَرِيكَ لَكَ لَبَّيْكَ إِنَّ الْحَمْدَ وَالنِّعْمَةَ لَكَ وَالْمُلْكَ لَا شَرِيكَ لَكَ',
        transliteration: 'Labbaykallahumma labbayk, labbayka la sharika laka labbayk, innal-hamda wan-ni\'mata laka wal-mulk, la sharika lak',
        translation: 'Here I am, O Allah, here I am. Here I am — You have no partner — here I am. Truly all praise, favour and dominion are Yours. You have no partner.',
        source: 'Bukhari 1549 · Muslim 1184'
    },
    {
        id: 'hajj-2',
        category: 'Hajj & Umrah',
        title: 'The Best Dua — Day of Arafah',
        arabic: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
        transliteration: 'La ilaha illallahu wahdahu la sharika lah, lahul-mulku wa lahul-hamdu wa huwa ala kulli shay\'in qadir',
        translation: 'There is no deity except Allah alone, without partner. His is the dominion, His is the praise, and He is over all things powerful. (The Prophet ﷺ said: the best dua is the dua of the Day of Arafah, and the best of what I and the prophets before me have said is this.)',
        source: 'Tirmidhi 3585'
    },
    {
        id: 'hajj-3',
        category: 'Hajj & Umrah',
        title: 'During Tawaf — Between the Yamani Corner and the Black Stone',
        arabic: 'رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ',
        transliteration: 'Rabbana atina fid-dunya hasanatan wa fil-akhirati hasanatan wa qina adhaban-nar',
        translation: 'Our Lord, give us good in this world and good in the Hereafter, and protect us from the punishment of the Fire. (The Prophet ﷺ said this between the Yamani corner and the Black Stone during tawaf.)',
        source: 'Abu Dawud 1892'
    },
    {
        id: 'hajj-4',
        category: 'Hajj & Umrah',
        title: 'When Drinking Zamzam',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا وَاسِعًا وَشِفَاءً مِنْ كُلِّ دَاءٍ',
        transliteration: 'Allahumma inni as\'aluka ilman nafi\'an wa rizqan wasi\'an wa shifa\'an min kulli da\'',
        translation: 'O Allah, I ask You for beneficial knowledge, abundant provision, and a cure from every illness. (Ibn Abbas\'s dua when drinking Zamzam — the Prophet ﷺ said Zamzam water is for whatever it is drunk for.)',
        source: 'Ibn Abbas — ad-Daraqutni · Ibn Majah 3062'
    },
    {
        id: 'hajj-5',
        category: 'Hajj & Umrah',
        title: 'At Safa and Marwah',
        arabic: 'إِنَّ الصَّفَا وَالْمَرْوَةَ مِنْ شَعَائِرِ اللَّهِ — اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ اللَّهُ أَكْبَرُ',
        transliteration: 'Innas-safa wal-marwata min sha\'a\'irillah — Allahu akbar, Allahu akbar, Allahu akbar',
        translation: 'Indeed, Safa and Marwah are among the symbols of Allah. (Recited when ascending Safa, facing the Kaaba, magnifying Allah three times, then making personal dua — repeated at Marwah.)',
        source: 'Quran 2:158 · Muslim 1218'
    },

    // ── Salah additions ──
    {
        id: 'salah-salawat-1',
        category: 'Salah',
        title: 'Salawat Ibrahimiyyah (Blessings on the Prophet ﷺ)',
        arabic: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا صَلَّيْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ اللَّهُمَّ بَارِكْ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ كَمَا بَارَكْتَ عَلَى إِبْرَاهِيمَ وَعَلَى آلِ إِبْرَاهِيمَ إِنَّكَ حَمِيدٌ مَجِيدٌ',
        transliteration: 'Allahumma salli ala Muhammadin wa ala ali Muhammad, kama sallayta ala Ibrahima wa ala ali Ibrahim, innaka hamidun majid. Allahumma barik ala Muhammadin wa ala ali Muhammad, kama barakta ala Ibrahima wa ala ali Ibrahim, innaka hamidun majid',
        translation: 'O Allah, send Your mercy upon Muhammad and the family of Muhammad, as You sent Your mercy upon Ibrahim and the family of Ibrahim — You are Praiseworthy, Glorious. O Allah, bless Muhammad and the family of Muhammad as You blessed Ibrahim and the family of Ibrahim — You are Praiseworthy, Glorious.',
        source: 'Bukhari 3370'
    },
    {
        id: 'salah-refuge-1',
        category: 'Salah',
        title: 'Before Tasleem — Refuge from Four Things',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنْ عَذَابِ جَهَنَّمَ وَمِنْ عَذَابِ الْقَبْرِ وَمِنْ فِتْنَةِ الْمَحْيَا وَالْمَمَاتِ وَمِنْ شَرِّ فِتْنَةِ الْمَسِيحِ الدَّجَّالِ',
        transliteration: 'Allahumma inni a\'udhu bika min adhabi jahannam, wa min adhabil-qabr, wa min fitnatil-mahya wal-mamat, wa min sharri fitnatil-masihid-dajjal',
        translation: 'O Allah, I seek refuge in You from the punishment of Hell, from the punishment of the grave, from the trials of life and death, and from the evil of the trial of the False Messiah.',
        source: 'Muslim 588'
    },

    // ── Guidance additions ──
    {
        id: 'guidance-4',
        category: 'Guidance',
        title: 'Keep My Heart Firm After Guidance',
        arabic: 'رَبَّنَا لَا تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً إِنَّكَ أَنتَ الْوَهَّابُ',
        transliteration: 'Rabbana la tuzigh qulubana ba\'da idh hadaytana wa hab lana min ladunka rahmah, innaka antal-wahhab',
        translation: 'Our Lord, do not let our hearts deviate after You have guided us, and grant us mercy from Yourself. Indeed, You are the Bestower.',
        source: 'Quran 3:8'
    },
    {
        id: 'guidance-5',
        category: 'Guidance',
        title: 'For Guidance and Uprightness',
        arabic: 'اللَّهُمَّ اهْدِنِي وَسَدِّدْنِي',
        transliteration: 'Allahumma-hdini wa saddidni',
        translation: 'O Allah, guide me and keep me on the straight path. (The Prophet ﷺ taught Ali to say this, remembering that guidance is like a straight road and uprightness like the straightness of an arrow.)',
        source: 'Muslim 2725'
    },

    // ── Anxiety addition ──
    {
        id: 'anxiety-7',
        category: 'Anxiety',
        title: 'Do Not Leave Me to Myself for the Blink of an Eye',
        arabic: 'اللَّهُمَّ رَحْمَتَكَ أَرْجُو فَلَا تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ وَأَصْلِحْ لِي شَأْنِي كُلَّهُ لَا إِلَهَ إِلَّا أَنْتَ',
        transliteration: 'Allahumma rahmataka arju fala takilni ila nafsi tarfata ayn, wa aslih li sha\'ni kullah, la ilaha illa ant',
        translation: 'O Allah, it is Your mercy I hope for — so do not leave me to myself even for the blink of an eye. Set right all my affairs. There is no deity except You. (The dua of the distressed.)',
        source: 'Abu Dawud 5090'
    },

    // ── Jannah addition ──
    {
        id: 'jannah-4',
        category: 'Jannah',
        title: 'Asking for Jannah, Refuge from the Fire',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْجَنَّةَ وَأَعُوذُ بِكَ مِنَ النَّارِ',
        transliteration: 'Allahumma inni as\'alukal-jannata wa a\'udhu bika minan-nar',
        translation: 'O Allah, I ask You for Paradise and I seek refuge in You from the Fire. (Whoever asks Allah for Jannah three times, Jannah says: O Allah, admit him to Jannah.)',
        source: 'Abu Dawud 792 · Tirmidhi 2572'
    },

    // ── Wealth addition ──
    {
        id: 'wealth-7',
        category: 'Wealth',
        title: 'Refuge from Sin and Debt',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْمَأْثَمِ وَالْمَغْرَمِ',
        transliteration: 'Allahumma inni a\'udhu bika minal-ma\'thami wal-maghram',
        translation: 'O Allah, I seek refuge in You from sin and from debt. (When asked why he sought refuge from debt so often, the Prophet ﷺ said: when a man is in debt, he speaks and lies, and he promises and breaks his promise.)',
        source: 'Bukhari 832'
    },

    // ── Grief & Loss addition ──
    {
        id: 'grief-6',
        category: 'Grief & Loss',
        title: 'The Funeral Prayer Dua',
        arabic: 'اللَّهُمَّ اغْفِرْ لِحَيِّنَا وَمَيِّتِنَا وَشَاهِدِنَا وَغَائِبِنَا وَصَغِيرِنَا وَكَبِيرِنَا وَذَكَرِنَا وَأُنْثَانَا اللَّهُمَّ مَنْ أَحْيَيْتَهُ مِنَّا فَأَحْيِهِ عَلَى الْإِسْلَامِ وَمَنْ تَوَفَّيْتَهُ مِنَّا فَتَوَفَّهُ عَلَى الْإِيمَانِ',
        transliteration: 'Allahumma-ghfir lihayyina wa mayyitina, wa shahidina wa gha\'ibina, wa saghirina wa kabirina, wa dhakarina wa unthana. Allahumma man ahyaytahu minna fa\'ahyihi alal-islam, wa man tawaffaytahu minna fatawaffahu alal-iman',
        translation: 'O Allah, forgive our living and our dead, those present and those absent, our young and our old, our males and our females. O Allah, whomever of us You keep alive, keep him alive upon Islam, and whomever of us You take, take him upon faith.',
        source: 'Tirmidhi 1024 · Abu Dawud 3201'
    },

    // ── Health addition ──
    {
        id: 'health-8',
        category: 'Health',
        title: 'Refuge from Devastating Illness',
        arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْبَرَصِ وَالْجُنُونِ وَالْجُذَامِ وَمِنْ سَيِّئِ الْأَسْقَامِ',
        transliteration: 'Allahumma inni a\'udhu bika minal-barasi wal-jununi wal-judhami wa min sayyi\'il-asqam',
        translation: 'O Allah, I seek refuge in You from leprosy, madness, disfiguring disease, and all terrible illnesses.',
        source: 'Abu Dawud 1554'
    },

    // ── Travel addition ──
    {
        id: 'travel-5',
        category: 'Travel',
        title: 'Farewell to a Traveller',
        arabic: 'أَسْتَوْدِعُ اللَّهَ دِينَكَ وَأَمَانَتَكَ وَخَوَاتِيمَ عَمَلِكَ',
        transliteration: 'Astawdi\'ullaha dinaka wa amanataka wa khawatima amalik',
        translation: 'I entrust to Allah your religion, your trusts, and the final outcome of your deeds. (Said to someone departing on a journey.)',
        source: 'Tirmidhi 3443 · Abu Dawud 2600'
    },

    // ── Friends addition ──
    {
        id: 'friends-5',
        category: 'Friends',
        title: 'Thanking Someone — Jazakallahu Khayran',
        arabic: 'جَزَاكَ اللَّهُ خَيْرًا',
        transliteration: 'Jazakallahu khayran',
        translation: 'May Allah reward you with good. (The Prophet ﷺ said: whoever says this to the one who did him a favour has fully expressed his thanks.)',
        source: 'Tirmidhi 2035 — Sahih'
    },

    // ── Marriage & Love additions ──
    {
        id: 'love-1',
        category: 'Marriage & Love',
        title: 'For the Love of Allah and Those Who Love Him',
        arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ حُبَّكَ وَحُبَّ مَنْ يُحِبُّكَ وَالْعَمَلَ الَّذِي يُبَلِّغُنِي حُبَّكَ اللَّهُمَّ اجْعَلْ حُبَّكَ أَحَبَّ إِلَيَّ مِنْ نَفْسِي وَأَهْلِي وَمِنَ الْمَاءِ الْبَارِدِ',
        transliteration: 'Allahumma inni as\'aluka hubbaka wa hubba man yuhibbuk, wal-amalal-ladhi yuballighuni hubbak. Allahumma-j\'al hubbaka ahabba ilayya min nafsi wa ahli wa minal-ma\'il-barid',
        translation: 'O Allah, I ask You for Your love, the love of those who love You, and the deeds that will bring me Your love. O Allah, make Your love dearer to me than myself, my family, and cold water. (The dua of Dawud — every love in your life flows rightly when this one comes first.)',
        source: 'Tirmidhi 3490'
    },
    {
        id: 'love-2',
        category: 'Marriage & Love',
        title: 'When Loneliness Weighs Heavy — Dua of Zakariyya',
        arabic: 'رَبِّ لَا تَذَرْنِي فَرْدًا وَأَنتَ خَيْرُ الْوَارِثِينَ',
        transliteration: 'Rabbi la tadharni fardan wa anta khayrul-warithin',
        translation: 'My Lord, do not leave me alone, and You are the best of inheritors. (Zakariyya\'s cry in old age — Allah answered him beyond anything he imagined.)',
        source: 'Quran 21:89'
    },
    {
        id: 'love-3',
        category: 'Marriage & Love',
        title: 'Congratulating Newlyweds',
        arabic: 'بَارَكَ اللَّهُ لَكَ وَبَارَكَ عَلَيْكَ وَجَمَعَ بَيْنَكُمَا فِي خَيْرٍ',
        transliteration: 'Barakallahu laka wa baraka alayka wa jama\'a baynakuma fi khayr',
        translation: 'May Allah bless you, shower His blessings upon you, and join you both in goodness. (The Prophet\'s ﷺ words of congratulation to a newly married person.)',
        source: 'Tirmidhi 1091 · Abu Dawud 2130'
    },
    {
        id: 'love-4',
        category: 'Marriage & Love',
        title: 'For Love and Unity Between Hearts',
        arabic: 'اللَّهُمَّ أَلِّفْ بَيْنَ قُلُوبِنَا وَأَصْلِحْ ذَاتَ بَيْنِنَا وَاهْدِنَا سُبُلَ السَّلَامِ',
        transliteration: 'Allahumma allif bayna qulubina wa aslih dhata baynina wahdina subulas-salam',
        translation: 'O Allah, join our hearts in love, mend what is between us, and guide us to the paths of peace. (For harmony in a marriage, a family, or between any two hearts that have drifted.)',
        source: 'Abu Dawud 969'
    },
];

export const categories = [
    'All',
    'Tahajjud & Night',
    'Daily Routine',
    'Morning & Evening',
    'Salah',
    'Exams & Study',
    'Work & Career',
    'Forgiveness',
    'Guidance',
    'Protection',
    'Anxiety',
    'Patience & Anger',
    'Weather & Nature',
    'Health',
    'Family',
    'Marriage & Love',
    'Wealth',
    'Knowledge',
    'Success',
    'Gratitude',
    'Grief & Loss',
    'Travel',
    'Hajj & Umrah',
    'Ramadan',
    'Ummah',
    'Sin & Temptation',
    'Evil Eye',
    'Jannah',
    'Friends',
];
