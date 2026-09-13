import { CaptionCue, MediaTranscript, LyricLine, TrackLyrics } from '../types';

const STORAGE_KEYS = {
  TRANSCRIPTS: 'skr_transcripts_v1',
  LYRICS: 'skr_lyrics_v1',
};

export const INITIAL_TRANSCRIPTS: Record<string, MediaTranscript> = {
  'vid-1': {
    mediaId: 'vid-1',
    title: 'Big Buck Bunny (HD)',
    nativeLanguageLabel: 'Dutch (Nederlands)',
    cues: [
      {
        id: 'c-1',
        start: 2,
        end: 7,
        textEnglish: 'In a peaceful sunny morning, the gentle giant awakens from his cozy tree burrow.',
        textNative: 'Op een rustige zonnige ochtend ontwaakt de vriendelijke reus uit zijn knusse boomhol.',
        speaker: 'Narrator',
      },
      {
        id: 'c-2',
        start: 8,
        end: 14,
        textEnglish: 'Dewdrops shimmer softly on the fresh green leaves and wild spring blossoms.',
        textNative: 'Dauwdruppels glinsteren zachtjes op de verse groene bladeren en wilde lentebloemen.',
        speaker: 'Narrator',
      },
      {
        id: 'c-3',
        start: 15,
        end: 22,
        textEnglish: 'A small colorful butterfly dances through the gentle forest breeze.',
        textNative: 'Een kleine kleurrijke vlinder danst door de zachte bosbries.',
        speaker: 'Narrator',
      },
      {
        id: 'c-4',
        start: 23,
        end: 31,
        textEnglish: 'Big Buck stretches his arms and inhales the pure pine scent of the woodland.',
        textNative: 'Big Buck strekt zijn armen en ademt de zuivere dennengeur van het bos in.',
        speaker: 'Narrator',
      },
      {
        id: 'c-5',
        start: 32,
        end: 42,
        textEnglish: 'He gently touches an apple blossom, taking care not to harm a single delicate petal.',
        textNative: 'Hij raakt teder een appelbloesem aan, zorgend geen enkel teder blaadje te schaden.',
        speaker: 'Narrator',
      },
      {
        id: 'c-6',
        start: 43,
        end: 54,
        textEnglish: 'Suddenly, a sly rustling echoes through the bushes. Three cheeky forest troublemakers watch from above.',
        textNative: 'Plotseling klinkt een listig geritsel door de struiken. Drie ondeugende bosstokers kijken toe van boven.',
        speaker: 'Frank (Flying Squirrel)',
      },
      {
        id: 'c-7',
        start: 55,
        end: 68,
        textEnglish: 'Frank the flying squirrel snickers and signals his accomplices with a flick of his tail.',
        textNative: 'Frank de vliegende eekhoorn gniffelt en seint zijn handlangers met een zwaai van zijn staart.',
        speaker: 'Rinky',
      },
      {
        id: 'c-8',
        start: 69,
        end: 82,
        textEnglish: '"Target locked! Prepare the acorn barrage on count of three!"',
        textNative: '"Doelwit vergrendeld! Maak het eikel-spervuur klaar op drie tellen!"',
        speaker: 'Frank',
      },
      {
        id: 'c-9',
        start: 83,
        end: 98,
        textEnglish: 'Big Buck glances up inquisitively as acorns tumble down like autumn hail.',
        textNative: 'Big Buck kijkt nieuwsgierig omhoog terwijl eikels als herfst-hagel neervallen.',
        speaker: 'Narrator',
      },
      {
        id: 'c-10',
        start: 99,
        end: 120,
        textEnglish: 'Patience has its limits. The gentle giant turns around and prepares his legendary forest traps.',
        textNative: 'Geduld heeft zijn grenzen. De vriendelijke reus draait zich om en bereidt zijn legendarische bosvallen voor.',
        speaker: 'Narrator',
      },
      {
        id: 'c-11',
        start: 121,
        end: 155,
        textEnglish: 'With clever knots and bent branches, nature itself becomes his grand retribution machine.',
        textNative: 'Met slimme knopen en gebogen takken wordt de natuur zelf zijn grote vergeldingstoestel.',
        speaker: 'Narrator',
      },
      {
        id: 'c-12',
        start: 156,
        end: 210,
        textEnglish: 'Justice is restored to the clearing, and peace returns to the happy rabbit family.',
        textNative: 'Gerechtigheid is hersteld in de open plek, en vrede keert terug naar de blije konijnenfamilie.',
        speaker: 'Narrator',
      },
    ],
  },
  'vid-2': {
    mediaId: 'vid-2',
    title: 'Tears of Steel (Sci-Fi Short)',
    nativeLanguageLabel: 'Dutch / French (Nederlands)',
    cues: [
      {
        id: 'tos-1',
        start: 0,
        end: 8,
        textEnglish: 'Amsterdam, Old Church Plaza. The dystopian skyline glows under crimson smoke.',
        textNative: 'Amsterdam, Oude Kerkplein. De dystopische skyline gloeit onder karmozijnrode rook.',
        speaker: 'Tactical Radio',
      },
      {
        id: 'tos-2',
        start: 9,
        end: 18,
        textEnglish: '"Signal strength is holding at seventy-four percent. Neural link approaching resonance."',
        textNative: '"Signaalsterkte houdt stand op vierenzeventig procent. Neurale verbinding nadert resonantie."',
        speaker: 'Thom',
      },
      {
        id: 'tos-3',
        start: 19,
        end: 27,
        textEnglish: '"Thom, you need to recalibrate the optical sensor before the drones cross sector four."',
        textNative: '"Thom, je moet de optische sensor herkalibreren voordat de drones sector vier binnendringen."',
        speaker: 'Celia',
      },
      {
        id: 'tos-4',
        start: 28,
        end: 39,
        textEnglish: '"I told you forty years ago... you did not have to let me go over a mechanical hand."',
        textNative: '"Ik zei het je veertig jaar geleden... je hoefde me niet te verlaten voor een mechanische hand."',
        speaker: 'Thom',
      },
      {
        id: 'tos-5',
        start: 40,
        end: 55,
        textEnglish: '"It wasn\'t just the cybernetics, Thom. You chose the machines over humanity!"',
        textNative: '"Het ging niet alleen om de cybernetica, Thom. Je koos de machines boven de mensheid!"',
        speaker: 'Celia',
      },
      {
        id: 'tos-6',
        start: 56,
        end: 75,
        textEnglish: '"Warning! Incoming heavy combat mechs detected bearing three-one-zero northwest!"',
        textNative: '"Waarschuwing! Inkomende zware gevechtsmechs gedetecteerd peiling drie-één-nul noordwest!"',
        speaker: 'AI Sentinel',
      },
      {
        id: 'tos-7',
        start: 76,
        end: 98,
        textEnglish: '"Hold the perimeter! Keep the memory synthesis chamber running until memory upload finishes!"',
        textNative: '"Behoud de perimeter! Houd de geheugensynthesekamer draaiend tot de upload voltooid is!"',
        speaker: 'Commander Barley',
      },
      {
        id: 'tos-8',
        start: 99,
        end: 135,
        textEnglish: '"The tears we shed today will wash the rusted steel of tomorrow."',
        textNative: '"De tranen die we vandaag vergieten zullen het verroeste staal van morgen schoonspoelen."',
        speaker: 'Celia',
      },
    ],
  },
  'vid-3': {
    mediaId: 'vid-3',
    title: 'Sintel (Fantasy Quest)',
    nativeLanguageLabel: 'Nordic / Gaelic (Gàidhlig)',
    cues: [
      {
        id: 'sin-1',
        start: 0,
        end: 10,
        textEnglish: 'Frozen winds howl across the treacherous peaks of the lonely northern mountain.',
        textNative: 'Gaoth reòta a\' sgriachail thar mullaichean cunnartach a\' bheinn uaigneach.',
        speaker: 'Narrator',
      },
      {
        id: 'sin-2',
        start: 11,
        end: 22,
        textEnglish: 'A lone wanderer pushes through waist-deep snow, her determination unyielding.',
        textNative: 'Tha neach-coiseachd aonaranach a\' putadh tro shneachda domhainn, a misneachd làidir.',
        speaker: 'Narrator',
      },
      {
        id: 'sin-3',
        start: 23,
        end: 36,
        textEnglish: '"Scales... I will find you. No matter how far the dragon took you from my hearth."',
        textNative: '"Scales... gheibh mi thu. Ge bith dè cho fada \'s a thug an dràgon thu bho mo chridhe."',
        speaker: 'Sintel',
      },
      {
        id: 'sin-4',
        start: 37,
        end: 55,
        textEnglish: 'She recalls the wounded baby dragon she nursed back to life in the alleyways of Ishtar.',
        textNative: 'Tha cuimhne aice air an dràgon leanabh leòinte a shlànaich i ann an caol-shràidean Ishtar.',
        speaker: 'Narrator',
      },
      {
        id: 'sin-5',
        start: 56,
        end: 80,
        textEnglish: 'The bond between girl and dragon forged in hunger and shared quiet warmth.',
        textNative: 'An ceangal eadar nighean agus dràgon air a chruthachadh ann an acras agus blàths sàmhach.',
        speaker: 'Narrator',
      },
    ],
  },
  'vid-4': {
    mediaId: 'vid-4',
    title: 'Elephants Dream (Open Animation)',
    nativeLanguageLabel: 'French (Français)',
    cues: [
      {
        id: 'ed-1',
        start: 0,
        end: 12,
        textEnglish: '"Welcome, Emo, to the Great Machine. Be careful where you step."',
        textNative: '"Bienvenue, Emo, dans la Grande Machine. Fais attention où tu mets les pieds."',
        speaker: 'Proog',
      },
      {
        id: 'ed-2',
        start: 13,
        end: 25,
        textEnglish: '"It\'s just a lot of useless cables and noisy cogs, Proog. There is nothing magical here."',
        textNative: '"Ce n\'est qu\'un tas de câbles inutiles et d\'engrenages bruyants, Proog. Il n\'y a rien de magique ici."',
        speaker: 'Emo',
      },
      {
        id: 'ed-3',
        start: 26,
        end: 42,
        textEnglish: '"You don\'t understand the interconnected symphony of gears! It breathes, Emo, it lives!"',
        textNative: '"Tu ne comprends pas la symphonie interconnectée des engrenages ! Elle respire, Emo, elle vit !"',
        speaker: 'Proog',
      },
    ],
  },
  'vid-5': {
    mediaId: 'vid-5',
    title: 'Chromecast Nature Showcase',
    nativeLanguageLabel: 'Spanish (Español)',
    cues: [
      {
        id: 'cns-1',
        start: 0,
        end: 4,
        textEnglish: 'Witness the serene majesty of pristine turquoise waters and untouched coral horizons.',
        textNative: 'Presencia la serena majestad de las aguas turquesas prístinas y los horizontes de coral virgen.',
        speaker: 'Narrator',
      },
      {
        id: 'cns-2',
        start: 5,
        end: 10,
        textEnglish: 'Sunlight refracts across golden ocean dunes, illuminating the living rhythm of the coast.',
        textNative: 'La luz del sol se refracta en las doradas dunas del océano, iluminando el ritmo vivo de la costa.',
        speaker: 'Narrator',
      },
      {
        id: 'cns-3',
        start: 11,
        end: 15,
        textEnglish: 'Every wave carries ancient whispers of the open sea and natural tranquility.',
        textNative: 'Cada ola lleva antiguos susurros del mar abierto y la tranquilidad natural.',
        speaker: 'Narrator',
      },
    ],
  },
};

export const INITIAL_LYRICS: Record<string, TrackLyrics> = {
  'aud-1': {
    mediaId: 'aud-1',
    title: 'Midnight Lofi Chillout',
    artist: 'Chillhop Beats',
    nativeLanguageLabel: 'Japanese (日本語)',
    hasSync: true,
    lines: [
      {
        id: 'l-1',
        time: 2,
        textEnglish: 'Raindrops tapping on the window glass',
        textNative: '窓ガラスを叩く雨の音',
        textRomanized: 'Mado garasu o tataku ame no oto',
      },
      {
        id: 'l-2',
        time: 8,
        textEnglish: 'Neon reflections fading as cars pass',
        textNative: '車が通り過ぎて消えゆくネオンの反射',
        textRomanized: 'Kuruma ga tōrisugite kieyuku neon no hansha',
      },
      {
        id: 'l-3',
        time: 15,
        textEnglish: 'Steaming coffee in a warm ceramic cup',
        textNative: '温かい陶器のカップに湯気立つコーヒー',
        textRomanized: 'Atatakai tōki no kappu ni yugetatsu kōhī',
      },
      {
        id: 'l-4',
        time: 22,
        textEnglish: 'Streetlights guide me as the quiet night wakes up',
        textNative: '静かな夜が目覚め 街灯が私を導く',
        textRomanized: 'Shizuka na yoru ga mezame gaitō ga watashi o michibiku',
      },
      {
        id: 'l-5',
        time: 30,
        textEnglish: 'Analog tape hissing softly in the dark',
        textNative: '暗闇の中で柔らかく囁くアナログテープ',
        textRomanized: 'Kurayami no naka de yawarakaku sasayaku anarogu tēpu',
      },
      {
        id: 'l-6',
        time: 38,
        textEnglish: 'In every quiet heartbeat leaving its mark',
        textNative: '静かな鼓動のすべてに足跡を残して',
        textRomanized: 'Shizuka na kodō no subete ni ashiato o nokoshite',
      },
      {
        id: 'l-7',
        time: 46,
        textEnglish: 'Lost inside these vinyl dreams tonight',
        textNative: '今夜 レコードの夢の中に迷い込んで',
        textRomanized: 'Kon\'ya rekōdo no yume no naka ni mayoikonde',
      },
      {
        id: 'l-8',
        time: 55,
        textEnglish: 'Drifting freely toward the morning light',
        textNative: '朝の光に向かって 自由に漂いながら',
        textRomanized: 'Asa no hikari ni mukatte jiyū ni tadayoinagara',
      },
      {
        id: 'l-9',
        time: 65,
        textEnglish: 'No worries calling, no rush to be seen',
        textNative: '焦ることもなく 求められることもなく',
        textRomanized: 'Aseru koto mo naku motomerareru koto mo naku',
      },
      {
        id: 'l-10',
        time: 75,
        textEnglish: 'Floating weightless in the spaces in between',
        textNative: '時の狭間に 重力さえ忘れて浮かんでいる',
        textRomanized: 'Toki no hazama ni jūryoku sae wasurete ukande iru',
      },
      {
        id: 'l-11',
        time: 88,
        textEnglish: 'Midnight melody, playing slow and sweet',
        textNative: '真夜中のメロディー ゆっくりと甘く響く',
        textRomanized: 'Mayonaka no merodī yukkuri to amaku hibiku',
      },
      {
        id: 'l-12',
        time: 102,
        textEnglish: 'Gentle cadence of the solitary street',
        textNative: '誰もいない通りの穏やかなリズム',
        textRomanized: 'Dare mo inai tōri no odayaka na rizumu',
      },
      {
        id: 'l-13',
        time: 120,
        textEnglish: 'Take a deep breath, let the world unwind',
        textNative: '深呼吸して 世界の喧騒を手放そう',
        textRomanized: 'Shinkokyū shite sekai no kensō o tebanasō',
      },
      {
        id: 'l-14',
        time: 140,
        textEnglish: 'Peace of mind is all we came to find',
        textNative: '私たちが探していたのは 心の安らぎだけ',
        textRomanized: 'Watashitachi ga sagashite ita no wa kokoro no yasuragi dake',
      },
    ],
  },
  'aud-2': {
    mediaId: 'aud-2',
    title: 'Neon Horizon - Synthwave',
    artist: 'Retro Wave Collective',
    nativeLanguageLabel: 'Korean (한국어)',
    hasSync: true,
    lines: [
      {
        id: 'nw-1',
        time: 3,
        textEnglish: 'Speeding down the electric purple highway',
        textNative: '보랏빛 전기의 고속도로를 질주해',
        textRomanized: 'Boratbit jeongi-ui gosokdororeul jiljuhae',
      },
      {
        id: 'nw-2',
        time: 12,
        textEnglish: 'Chrome dashboard reflects the cyber haze',
        textNative: '크롬 계기판에 비치는 사이버 안개',
        textRomanized: 'Keurom gyegipane bichineun saibeo angae',
      },
      {
        id: 'nw-3',
        time: 21,
        textEnglish: 'Synthesizer rhythms pumping in my veins',
        textNative: '혈관 속을 요동치는 신시사이저 비트',
        textRomanized: 'Hyeolgwan sogeul yodongchineun sinsisaijeo biteu',
      },
      {
        id: 'nw-4',
        time: 32,
        textEnglish: 'Breaking every limit, cutting all the chains',
        textNative: '모든 한계를 부수고 사슬을 끊어내며',
        textRomanized: 'Modeun hangyereul busugo saseureul kkeun-eonaemyeo',
      },
      {
        id: 'nw-5',
        time: 44,
        textEnglish: 'Retrofuturistic dreams glowing in the night',
        textNative: '어둠 속을 밝히는 레트로 퓨처의 꿈',
        textRomanized: 'Eodum sogeul balkhineun reteuro pyucheo-ui kkum',
      },
      {
        id: 'nw-6',
        time: 58,
        textEnglish: 'Chasing the digital sun with speed of light',
        textNative: '빛의 속도로 디지털 태양을 쫓아서',
        textRomanized: 'Bichui sokdoro dijiteol taeyang-eul jjoch-aseo',
      },
      {
        id: 'nw-7',
        time: 75,
        textEnglish: 'Never looking back, the past is out of sight',
        textNative: '뒤돌아보지 마, 과거는 이미 사라졌으니',
        textRomanized: 'Dwidora-boji ma, gwageoneun imi sarajyeosseuni',
      },
      {
        id: 'nw-8',
        time: 92,
        textEnglish: 'Neon city burning eternal and bright',
        textNative: '네온 시티는 영원히 밝게 타오른다',
        textRomanized: 'Neon sitineun yeong-wonhi balkge ta-oreunda',
      },
    ],
  },
  'aud-3': {
    mediaId: 'aud-3',
    title: 'Acoustic Morning Breeze',
    artist: 'Acoustic Wanderer',
    nativeLanguageLabel: 'Spanish (Español)',
    hasSync: true,
    lines: [
      {
        id: 'ac-1',
        time: 2,
        textEnglish: 'Golden sunlight filters through the mountain pine',
        textNative: 'La luz dorada se filtra entre los pinos de la montaña',
        textRomanized: 'La luz dorada se filtra entre los pinos de la montaña',
      },
      {
        id: 'ac-2',
        time: 10,
        textEnglish: 'A warm gentle breeze crossing the river line',
        textNative: 'Una suave y tibia brisa cruza la línea del río',
        textRomanized: 'Una suave y tibia brisa cruza la línea del río',
      },
      {
        id: 'ac-3',
        time: 20,
        textEnglish: 'Six steel strings whispering sweet and clear',
        textNative: 'Seis cuerdas de acero susurran dulces y claras',
        textRomanized: 'Seis cuerdas de acero susurran dulces y claras',
      },
      {
        id: 'ac-4',
        time: 32,
        textEnglish: 'Washing away every lingering doubt and fear',
        textNative: 'Borrando cualquier duda o miedo que pudiera quedar',
        textRomanized: 'Borrando cualquier duda o miedo que pudiera quedar',
      },
      {
        id: 'ac-5',
        time: 48,
        textEnglish: 'Footsteps on the winding dirt pathway home',
        textNative: 'Pasos en el sendero de tierra que conduce a casa',
        textRomanized: 'Pasos en el sendero de tierra que conduce a casa',
      },
      {
        id: 'ac-6',
        time: 65,
        textEnglish: 'In this vast wild meadow never feeling alone',
        textNative: 'En este inmenso prado nunca me siento en soledad',
        textRomanized: 'En este inmenso prado nunca me siento en soledad',
      },
      {
        id: 'ac-7',
        time: 85,
        textEnglish: 'Morning breeze, carry my melody far and wide',
        textNative: 'Brisa matinal, lleva mi melodía a todas partes',
        textRomanized: 'Brisa matinal, lleva mi melodía a todas partes',
      },
      {
        id: 'ac-8',
        time: 110,
        textEnglish: 'With hope and boundless peace walking by my side',
        textNative: 'Con esperanza y paz infinita caminando a mi lado',
        textRomanized: 'Con esperanza y paz infinita caminando a mi lado',
      },
    ],
  },
  'aud-4': {
    mediaId: 'aud-4',
    title: 'Piano Sonata in Twilight',
    artist: 'Claire Deville',
    nativeLanguageLabel: 'French (Français)',
    hasSync: true,
    lines: [
      {
        id: 'pn-1',
        time: 4,
        textEnglish: 'Ivory keys echo in the twilight hall',
        textNative: 'Les touches d\'ivoire résonnent dans la salle crépusculaire',
        textRomanized: 'Les touches d\'ivoire résonnent dans la salle crépusculaire',
      },
      {
        id: 'pn-2',
        time: 16,
        textEnglish: 'Shadows dance softly along the wooden wall',
        textNative: 'Les ombres dansent doucement le long du mur en bois',
        textRomanized: 'Les ombres dansent doucement le long du mur en bois',
      },
      {
        id: 'pn-3',
        time: 30,
        textEnglish: 'A sonata of memories tender and deep',
        textNative: 'Une sonate de souvenirs tendres et profonds',
        textRomanized: 'Une sonate de souvenirs tendres et profonds',
      },
      {
        id: 'pn-4',
        time: 48,
        textEnglish: 'Singing the quiet universe to sleep',
        textNative: 'Bercant l\'univers silencieux vers le sommeil',
        textRomanized: 'Bercant l\'univers silencieux vers le sommeil',
      },
      {
        id: 'pn-5',
        time: 70,
        textEnglish: 'Each chord a promise written in the starry skies',
        textNative: 'Chaque accord est une promesse gravée dans le ciel étoilé',
        textRomanized: 'Chaque accord est une promesse gravée dans le ciel étoilé',
      },
      {
        id: 'pn-6',
        time: 100,
        textEnglish: 'Where true beauty blossoms and never dies',
        textNative: 'Où la véritable beauté fleurit et ne meurt jamais',
        textRomanized: 'Où la véritable beauté fleurit et ne meurt jamais',
      },
    ],
  },
  'aud-5': {
    mediaId: 'aud-5',
    title: 'Deep Ocean Ambient Drone',
    artist: 'Soundscape Lab',
    nativeLanguageLabel: 'Hindi (हिंदी)',
    hasSync: true,
    lines: [
      {
        id: 'oc-1',
        time: 5,
        textEnglish: 'Descent into the abyssal oceanic blue',
        textNative: 'अथाह गहरे नीले सागर में उतरते हुए',
        textRomanized: 'Athaah gehre neele saagar mein utarte hue',
      },
      {
        id: 'oc-2',
        time: 25,
        textEnglish: 'Silence deeper than anything we ever knew',
        textNative: 'एक ऐसा मौन जो हर अनुभव से गहरा है',
        textRomanized: 'Ek aisa maun jo har anubhav se gehra hai',
      },
      {
        id: 'oc-3',
        time: 55,
        textEnglish: 'Tidal currents sway with cosmic tranquility',
        textNative: 'ब्रह्मांडीय शांति के साथ डोलती लहरें',
        textRomanized: 'Brahmaandiya shaanti ke saath dolti lehrein',
      },
      {
        id: 'oc-4',
        time: 95,
        textEnglish: 'Dissolving all thought in pure infinity',
        textNative: 'अनंत शून्यता में विलीन होते सभी विचार',
        textRomanized: 'Anant shunya-ta mein vileen hote sabhi vichaar',
      },
      {
        id: 'oc-5',
        time: 140,
        textEnglish: 'Breathe with the eternal rhythm of the sea',
        textNative: 'समुद्र की शाश्वत लय के साथ सांस लो',
        textRomanized: 'Samudra ki shaashwat lay ke saath saans lo',
      },
      {
        id: 'oc-6',
        time: 190,
        textEnglish: 'Untouched, weightless, entirely free',
        textNative: 'अछूता, भारहीन, पूर्णतः मुक्त',
        textRomanized: 'Achhoota, bhaar-heen, poornatah mukt',
      },
    ],
  },
};

export function getTranscriptForMedia(mediaId: string): MediaTranscript | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRANSCRIPTS);
    if (stored) {
      const parsed: Record<string, MediaTranscript> = JSON.parse(stored);
      if (parsed[mediaId]) return parsed[mediaId];
    }
  } catch (e) {
    console.error('Failed to get transcript from storage', e);
  }
  return INITIAL_TRANSCRIPTS[mediaId] || null;
}

export function saveCustomTranscript(transcript: MediaTranscript): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRANSCRIPTS);
    const existing: Record<string, MediaTranscript> = stored ? JSON.parse(stored) : { ...INITIAL_TRANSCRIPTS };
    existing[transcript.mediaId] = transcript;
    localStorage.setItem(STORAGE_KEYS.TRANSCRIPTS, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save custom transcript', e);
  }
}

export function getLyricsForMedia(mediaId: string): TrackLyrics | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LYRICS);
    if (stored) {
      const parsed: Record<string, TrackLyrics> = JSON.parse(stored);
      if (parsed[mediaId]) return parsed[mediaId];
    }
  } catch (e) {
    console.error('Failed to get lyrics from storage', e);
  }
  return INITIAL_LYRICS[mediaId] || null;
}

export function saveCustomLyrics(lyrics: TrackLyrics): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LYRICS);
    const existing: Record<string, TrackLyrics> = stored ? JSON.parse(stored) : { ...INITIAL_LYRICS };
    existing[lyrics.mediaId] = lyrics;
    localStorage.setItem(STORAGE_KEYS.LYRICS, JSON.stringify(existing));
  } catch (e) {
    console.error('Failed to save custom lyrics', e);
  }
}

// Convert seconds to SRT timestamp format: 00:01:23,456
function toSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// Parse timestamp string from SRT / VTT: 00:01:23,456 or 01:23.45
function parseTimestamp(ts: string): number {
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s);
  } else if (parts.length === 2) {
    const [m, s] = parts;
    return parseFloat(m) * 60 + parseFloat(s);
  }
  return parseFloat(clean) || 0;
}

// SRT / VTT Parser
export function parseSrtOrVtt(rawText: string, mediaId: string, title?: string): MediaTranscript {
  const cues: CaptionCue[] = [];
  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let i = 0;
  let cueIndex = 1;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
      i++;
      continue;
    }

    // Check if next line contains arrow "-->"
    let timeLine = '';
    let startIdx = i;
    if (line.includes('-->')) {
      timeLine = line;
    } else if (i + 1 < lines.length && lines[i + 1].includes('-->')) {
      timeLine = lines[i + 1];
      i++;
    }

    if (timeLine) {
      const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim().split(' ')[0]);
      const start = parseTimestamp(startStr);
      const end = parseTimestamp(endStr);

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].trim());
        i++;
      }

      if (textLines.length > 0) {
        // Check if there are dual lines (e.g. line 1 native, line 2 english)
        let textEnglish = textLines.join(' ');
        let textNative: string | undefined = undefined;

        if (textLines.length >= 2) {
          textNative = textLines[0];
          textEnglish = textLines.slice(1).join(' ');
        }

        cues.push({
          id: `cue-${mediaId}-${cueIndex++}`,
          start,
          end,
          textEnglish,
          textNative,
        });
      }
    } else {
      i++;
    }
  }

  return {
    mediaId,
    title: title || 'Imported Transcript',
    cues,
  };
}

// LRC Lyrics Parser (e.g. [00:12.34]Lyric line)
export function parseLrc(rawText: string, mediaId: string, title?: string, artist?: string): TrackLyrics {
  const lines: LyricLine[] = [];
  const rawLines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  let lineIndex = 1;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\](.*)$/);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseFloat(match[2]);
      const time = mins * 60 + secs;
      const text = match[3].trim();

      // Check if text has dual delimiter (e.g. "Native / English" or "Native | English")
      let textEnglish = text;
      let textNative: string | undefined = undefined;

      if (text.includes(' / ')) {
        const parts = text.split(' / ');
        textNative = parts[0].trim();
        textEnglish = parts.slice(1).join(' / ').trim();
      } else if (text.includes(' | ')) {
        const parts = text.split(' | ');
        textNative = parts[0].trim();
        textEnglish = parts.slice(1).join(' | ').trim();
      }

      lines.push({
        id: `lyric-${mediaId}-${lineIndex++}`,
        time,
        textEnglish: textEnglish || textNative || '',
        textNative,
      });
    } else {
      // Unsynced plain line
      lines.push({
        id: `lyric-${mediaId}-${lineIndex++}`,
        time: (lineIndex - 1) * 4,
        textEnglish: trimmed,
      });
    }
  }

  // Sort chronologically
  lines.sort((a, b) => a.time - b.time);

  return {
    mediaId,
    title: title || 'Imported Lyrics',
    artist: artist || 'Unknown Artist',
    hasSync: lines.some((l) => l.time > 0),
    lines,
  };
}

// Export Transcript as SRT
export function exportTranscriptAsSrt(transcript: MediaTranscript, mode: 'english' | 'native' | 'dual' = 'dual'): string {
  return transcript.cues
    .map((cue, idx) => {
      const timeStr = `${toSrtTimestamp(cue.start)} --> ${toSrtTimestamp(cue.end)}`;
      let text = cue.textEnglish;
      if (mode === 'native' && cue.textNative) {
        text = cue.textNative;
      } else if (mode === 'dual' && cue.textNative) {
        text = `${cue.textNative}\n${cue.textEnglish}`;
      }
      return `${idx + 1}\n${timeStr}\n${text}\n`;
    })
    .join('\n');
}

// Export Transcript as plain text
export function exportTranscriptAsTxt(transcript: MediaTranscript, mode: 'english' | 'native' | 'dual' = 'dual'): string {
  return transcript.cues
    .map((cue) => {
      const m = Math.floor(cue.start / 60);
      const s = Math.floor(cue.start % 60);
      const ts = `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`;
      if (mode === 'native' && cue.textNative) {
        return `${ts} ${cue.textNative}`;
      } else if (mode === 'dual' && cue.textNative) {
        return `${ts} ${cue.textNative} / ${cue.textEnglish}`;
      }
      return `${ts} ${cue.textEnglish}`;
    })
    .join('\n');
}

// Export Lyrics as LRC
export function exportLyricsAsLrc(lyrics: TrackLyrics, mode: 'english' | 'native' | 'dual' | 'romanized' = 'dual'): string {
  const header = `[ti:${lyrics.title || ''}]\n[ar:${lyrics.artist || ''}]\n[re:SKR Player]\n\n`;
  const body = lyrics.lines
    .map((line) => {
      const m = Math.floor(line.time / 60);
      const s = Math.floor(line.time % 60);
      const ms = Math.floor((line.time % 1) * 100);
      const ts = `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}]`;

      let text = line.textEnglish;
      if (mode === 'native' && line.textNative) {
        text = line.textNative;
      } else if (mode === 'romanized' && line.textRomanized) {
        text = line.textRomanized;
      } else if (mode === 'dual' && line.textNative) {
        text = `${line.textNative} / ${line.textEnglish}`;
      }
      return `${ts}${text}`;
    })
    .join('\n');

  return header + body;
}
