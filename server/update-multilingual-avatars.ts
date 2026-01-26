/**
 * Update Multilingual Agents with new culturally-appropriate avatars
 */

import { db } from "./db";
import { agents } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const AVATAR_MAPPINGS: Record<string, Record<string, string>> = {
  ar: {
    "أ.د. أماندا تشن": "/src/assets/avatars/ar-professor-amanda.png",
    "أحمد الصالح": "/src/assets/avatars/ar-ahmad-saleh.png",
    "أنطونيو الرومي": "/src/assets/avatars/ar-antonio-romano.png",
    "إليزابيث ستيرلينج": "/src/assets/avatars/ar-elizabeth-sterling.png",
    "باتريشيا والش": "/src/assets/avatars/ar-patricia-walsh.png",
    "خالد المنصور": "/src/assets/avatars/ar-khaled-mansour.png",
    "د. أمل المهدي": "/src/assets/avatars/ar-dr-amal.png",
    "د. ريبيكا ستون": "/src/assets/avatars/ar-dr-rebecca.png",
    "دانيال كوبر": "/src/assets/avatars/ar-daniel-cooper.png",
    "دينا الجبالي": "/src/assets/avatars/ar-dina-jabali.png",
    "رامي الحياة": "/src/assets/avatars/ar-rami-hayat.png",
    "رانيا الفيصل": "/src/assets/avatars/ar-rania-faisal.png",
    "سارة الحسيني": "/src/assets/avatars/ar-sarah-hussaini.png",
    "سمية البروك": "/src/assets/avatars/ar-sumaya-brook.png",
    "طارق البركات": "/src/assets/avatars/ar-tarek-barakat.png",
    "فاطمة الزهراء": "/src/assets/avatars/ar-fatima-zahra.png",
    "كاترين بليك": "/src/assets/avatars/ar-catherine-blake.png",
    "كريس مارتينيز": "/src/assets/avatars/ar-chris-martinez.png",
    "كريم البدوي": "/src/assets/avatars/ar-karim-badawi.png",
    "ليلى الراشد": "/src/assets/avatars/ar-layla-rashid.png",
    "ماركو فالنتينو": "/src/assets/avatars/ar-marco-valentino.png",
    "مايكل توريس": "/src/assets/avatars/ar-michael-torres.png",
    "محمد العلي": "/src/assets/avatars/ar-mohammed-ali.png",
    "مريم العتيبي": "/src/assets/avatars/ar-maryam-otaibi.png",
    "ميليسا تيرنر": "/src/assets/avatars/ar-melissa-turner.png",
    "نادية الوردي": "/src/assets/avatars/ar-nadia-wardi.png",
    "نور القحطاني": "/src/assets/avatars/ar-nour-qahtani.png",
    "نيكول حارب": "/src/assets/avatars/ar-nicole-harb.png",
    "هند السعيد": "/src/assets/avatars/ar-hind-said.png",
    "ويليام كروفورد": "/src/assets/avatars/ar-william-crawford.png",
    "يوسف الحربي": "/src/assets/avatars/ar-yusuf-harbi.png",
  },
  fr: {
    "Marc Dupont": "/src/assets/avatars/fr-marc-dupont.png",
    "Sophie Martin": "/src/assets/avatars/fr-sophie-martin.png",
    "Jacques Bernard": "/src/assets/avatars/fr-jacques-bernard.png",
    "Alexandre Moreau": "/src/assets/avatars/fr-alexandre-moreau.png",
    "Émilie Dubois": "/src/assets/avatars/fr-emilie-dubois.png",
    "Sarah Lefebvre": "/src/assets/avatars/fr-sarah-lefebvre.png",
    "David Leroy": "/src/assets/avatars/fr-david-leroy.png",
    "Rachel Girard": "/src/assets/avatars/fr-rachel-girard.png",
    "Jessica Rousseau": "/src/assets/avatars/fr-jessica-rousseau.png",
    "Jennifer Adam": "/src/assets/avatars/fr-jennifer-adam.png",
    "Dr. Amanda Fontaine": "/src/assets/avatars/fr-dr-amanda-fontaine.png",
    "Kevin Blanc": "/src/assets/avatars/fr-kevin-blanc.png",
    "Linda Mathieu": "/src/assets/avatars/fr-linda-mathieu.png",
    "Victoria Jacques": "/src/assets/avatars/fr-victoria-jacques.png",
    "Antoine Romain": "/src/assets/avatars/fr-antoine-romain.png",
    "Natalie Rose": "/src/assets/avatars/fr-natalie-rose.png",
    "Catherine Blanc": "/src/assets/avatars/fr-catherine-blanc.png",
    "Théo Broussard": "/src/assets/avatars/fr-theo-broussard.png",
    "Marco Valentin": "/src/assets/avatars/fr-marco-valentin.png",
    "Professeur Amanda Chen": "/src/assets/avatars/fr-professeur-amanda-chen.png",
    "Nicole Hébert": "/src/assets/avatars/fr-nicole-hebert.png",
    "Christophe Martinez": "/src/assets/avatars/fr-christophe-martinez.png",
    "Patricia Leblanc": "/src/assets/avatars/fr-patricia-leblanc.png",
    "Daniel Couperin": "/src/assets/avatars/fr-daniel-couperin.png",
    "Samantha Broussard": "/src/assets/avatars/fr-samantha-broussard.png",
    "Robert Hayet": "/src/assets/avatars/fr-robert-hayet.png",
    "Élisabeth Sterling": "/src/assets/avatars/fr-elisabeth-sterling.png",
    "Dr. Rébecca Pierre": "/src/assets/avatars/fr-dr-rebecca-pierre.png",
    "Michel Torres": "/src/assets/avatars/fr-michel-torres.png",
    "Mélissa Tournier": "/src/assets/avatars/fr-melissa-tournier.png",
    "Guillaume Croissant": "/src/assets/avatars/fr-guillaume-croissant.png",
  },
  it: {
    "Marco Rossi": "/src/assets/avatars/it-marco-rossi.png",
    "Sofia Bianchi": "/src/assets/avatars/it-sofia-bianchi.png",
    "Giacomo Ferrari": "/src/assets/avatars/it-giacomo-ferrari.png",
    "Alessandro Romano": "/src/assets/avatars/it-alessandro-romano.png",
    "Emilia Colombo": "/src/assets/avatars/it-emilia-colombo.png",
    "Sara Ricci": "/src/assets/avatars/it-sara-ricci.png",
    "Davide Parco": "/src/assets/avatars/it-davide-parco.png",
    "Rachele Verdi": "/src/assets/avatars/it-rachele-verdi.png",
    "Jessica Esposito": "/src/assets/avatars/it-jessica-esposito.png",
    "Ginevra Adami": "/src/assets/avatars/it-ginevra-adami.png",
    "Dott.ssa Amanda Fiorentino": "/src/assets/avatars/it-dott-amanda-fiorentino.png",
    "Kevin Bruno": "/src/assets/avatars/it-kevin-bruno.png",
    "Linda Mattei": "/src/assets/avatars/it-linda-mattei.png",
    "Vittoria Giordano": "/src/assets/avatars/it-vittoria-giordano.png",
    "Antonio Romano": "/src/assets/avatars/it-antonio-romano.png",
    "Natalia Rosa": "/src/assets/avatars/it-natalia-rosa.png",
    "Caterina Bianco": "/src/assets/avatars/it-caterina-bianco.png",
    "Tiziano Bruni": "/src/assets/avatars/it-tiziano-bruni.png",
    "Marco Valentino": "/src/assets/avatars/it-marco-valentino.png",
    "Prof.ssa Amanda Chen": "/src/assets/avatars/it-prof-amanda-chen.png",
    "Nicola Marchetti": "/src/assets/avatars/it-nicola-marchetti.png",
    "Cristiano Martinelli": "/src/assets/avatars/it-cristiano-martinelli.png",
    "Patrizia Valenti": "/src/assets/avatars/it-patrizia-valenti.png",
    "Daniele Costa": "/src/assets/avatars/it-daniele-costa.png",
    "Samanta Bruni": "/src/assets/avatars/it-samanta-bruni.png",
    "Roberto Conti": "/src/assets/avatars/it-roberto-conti.png",
    "Elisabetta Stella": "/src/assets/avatars/it-elisabetta-stella.png",
    "Dott.ssa Rebecca Pietra": "/src/assets/avatars/it-dott-rebecca-pietra.png",
    "Michele Torre": "/src/assets/avatars/it-michele-torre.png",
    "Melissa Tornatore": "/src/assets/avatars/it-melissa-tornatore.png",
    "Guglielmo Crotti": "/src/assets/avatars/it-guglielmo-crotti.png",
  },
  zh: {
    "马超 (Ma Chao)": "/src/assets/avatars/zh-ma-chao.png",
    "陈雅婷 (Chen Yating)": "/src/assets/avatars/zh-chen-yating.png",
    "李明 (Li Ming)": "/src/assets/avatars/zh-li-ming.png",
    "张伟 (Zhang Wei)": "/src/assets/avatars/zh-zhang-wei.png",
    "王芳 (Wang Fang)": "/src/assets/avatars/zh-wang-fang.png",
    "刘静 (Liu Jing)": "/src/assets/avatars/zh-liu-jing.png",
    "朴大卫 (Piao Dawei)": "/src/assets/avatars/zh-piao-dawei.png",
    "赵欣 (Zhao Xin)": "/src/assets/avatars/zh-zhao-xin.png",
    "李佳琪 (Li Jiaqi)": "/src/assets/avatars/zh-li-jiaqi.png",
    "金美玲 (Jin Meiling)": "/src/assets/avatars/zh-jin-meiling.png",
    "傅博士 (Dr. Fu)": "/src/assets/avatars/zh-dr-fu.png",
    "欧阳凯 (Ouyang Kai)": "/src/assets/avatars/zh-ouyang-kai.png",
    "林小萌 (Lin Xiaomeng)": "/src/assets/avatars/zh-lin-xiaomeng.png",
    "郝雅兰 (Hao Yalan)": "/src/assets/avatars/zh-hao-yalan.png",
    "罗马诺 (Luomano)": "/src/assets/avatars/zh-luomano.png",
    "罗丝 (Luo Si)": "/src/assets/avatars/zh-luo-si.png",
    "凯瑟琳 (Kaiselin)": "/src/assets/avatars/zh-kaiselin.png",
    "布鲁克斯 (Bulukesi)": "/src/assets/avatars/zh-bulukesi-ecom.png",
    "马可 (Ma Ke)": "/src/assets/avatars/zh-ma-ke.png",
    "陈教授 (Prof. Chen)": "/src/assets/avatars/zh-prof-chen.png",
    "哈珀 (Hape)": "/src/assets/avatars/zh-hape.png",
    "马丁内斯 (Madineisi)": "/src/assets/avatars/zh-madineisi.png",
    "帕特里夏·沃尔什 (Patricia Walsh)": "/src/assets/avatars/zh-patricia-walsh.png",
    "库珀 (Kupe)": "/src/assets/avatars/zh-kupe.png",
    "海斯 (Haisi)": "/src/assets/avatars/zh-haisi.png",
    "伊丽莎白 (Yilishabai)": "/src/assets/avatars/zh-yilishabai.png",
    "斯通博士 (Dr. Stone)": "/src/assets/avatars/zh-dr-stone.png",
    "迈克尔·托雷斯 (Michael Torres)": "/src/assets/avatars/zh-michael-torres.png",
    "梅丽莎·特纳 (Melissa Turner)": "/src/assets/avatars/zh-melissa-turner.png",
    "威廉·克劳福德 (William Crawford)": "/src/assets/avatars/zh-william-crawford.png",
  },
  hi: {
    "मनीष शर्मा (Manish Sharma)": "/src/assets/avatars/hi-manish-sharma.png",
    "सोफिया चेन (Sophia Chen)": "/src/assets/avatars/hi-sophia-chen.png",
    "जयेश राव (Jayesh Rao)": "/src/assets/avatars/hi-jayesh-rao.png",
    "अलेक्स त्रिपाठी (Alex Tripathi)": "/src/assets/avatars/hi-alex-tripathi.png",
    "ईमिली वर्मा (Emily Verma)": "/src/assets/avatars/hi-emily-verma.png",
    "सारा मिश्रा (Sara Mishra)": "/src/assets/avatars/hi-sara-mishra.png",
    "दीपक पार्क (Deepak Park)": "/src/assets/avatars/hi-deepak-park.png",
    "राधिका गुप्ता (Radhika Gupta)": "/src/assets/avatars/hi-radhika-gupta.png",
    "जेसिका सिंह (Jessica Singh)": "/src/assets/avatars/hi-jessica-singh.png",
    "जेनिफर आदम (Jennifer Adam)": "/src/assets/avatars/hi-jennifer-adam.png",
    "डॉ. अमांडा फोस्टर (Dr. Amanda Foster)": "/src/assets/avatars/hi-dr-amanda-foster.png",
    "केविन ओ'ब्रायन (Kevin O'Brien)": "/src/assets/avatars/hi-kevin-obrien.png",
    "लिंडा माथुर (Linda Mathur)": "/src/assets/avatars/hi-linda-mathur.png",
    "विक्टोरिया जेम्स (Victoria James)": "/src/assets/avatars/hi-victoria-james.png",
    "एंथनी रोमानो (Anthony Romano)": "/src/assets/avatars/hi-anthony-romano.png",
    "नताली रोज़ (Natalie Rose)": "/src/assets/avatars/hi-natalie-rose.png",
    "कैथरीन ब्लेक (Catherine Blake)": "/src/assets/avatars/hi-catherine-blake.png",
    "टायलर ब्रुक्स (Tyler Brooks)": "/src/assets/avatars/hi-tyler-brooks.png",
    "मार्को वेलेंटिनो (Marco Valentino)": "/src/assets/avatars/hi-marco-valentino.png",
    "प्रोफेसर अमांडा चेन": "/src/assets/avatars/hi-prof-amanda-chen.png",
    "निकोल हार्पर (Nicole Harper)": "/src/assets/avatars/hi-nicole-harper.png",
    "क्रिस मार्टिनेज (Chris Martinez)": "/src/assets/avatars/hi-chris-martinez.png",
    "पेट्रीसिया वॉल्श (Patricia Walsh)": "/src/assets/avatars/hi-patricia-walsh.png",
    "डेनियल कूपर (Daniel Cooper)": "/src/assets/avatars/hi-daniel-cooper.png",
    "समंता ब्रुक्स (Samantha Brooks)": "/src/assets/avatars/hi-samantha-brooks.png",
    "रॉबर्ट हेज़ (Robert Hayes)": "/src/assets/avatars/hi-robert-hayes.png",
    "एलिज़ाबेथ स्टर्लिंग (Elizabeth Sterling)": "/src/assets/avatars/hi-elizabeth-sterling.png",
    "डॉ. रेबेका स्टोन (Dr. Rebecca Stone)": "/src/assets/avatars/hi-dr-rebecca-stone.png",
    "माइकल टोरेस (Michael Torres)": "/src/assets/avatars/hi-michael-torres.png",
    "मेलिसा टर्नर (Melissa Turner)": "/src/assets/avatars/hi-melissa-turner.png",
    "विलियम क्रॉफर्ड (William Crawford)": "/src/assets/avatars/hi-william-crawford.png",
  },
};

async function updateAvatars() {
  console.log("Starting avatar URL update...");
  let updated = 0;

  for (const [lang, mappings] of Object.entries(AVATAR_MAPPINGS)) {
    console.log(`\nUpdating ${lang} avatars...`);
    for (const [name, avatarUrl] of Object.entries(mappings)) {
      const result = await db.update(agents)
        .set({ avatarUrl })
        .where(and(eq(agents.name, name), eq(agents.language, lang)));
      updated++;
    }
    console.log(`  Updated ${Object.keys(mappings).length} agents`);
  }

  console.log(`\nCompleted! Updated ${updated} avatar URLs.`);
}

updateAvatars()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
