/**
 * Comprehensive Bangladesh Bus Stop / Terminal / Point Locations
 * Organized by Division > District > Locations
 * Used for boarding and dropping point selection in operator dashboard
 */

export interface BDLocation {
  name: string;
  address: string;
  division: string;
  district: string;
}

// ─── Raw location data organized by division/district ──────────────────
const locationData: Record<string, Record<string, { name: string; address: string }[]>> = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DHAKA DIVISION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Dhaka: {
    Dhaka: [
      { name: "Gabtoli Bus Terminal", address: "Gabtoli, Mirpur, Dhaka" },
      { name: "Gabtoli Mazar Road", address: "Old Gabtoli, Mirpur, Dhaka-1216" },
      { name: "Mohakhali Bus Terminal", address: "Mohakhali, Dhaka-1212" },
      { name: "Sayedabad Bus Terminal", address: "Sayedabad, Dhaka-1000" },
      { name: "Abdullahpur Bus Stand", address: "Abdullahpur, Uttara, Dhaka" },
      { name: "Kalyanpur Bus Stand", address: "Kalyanpur, Dhaka-1207" },
      { name: "Kallyanpur Counter", address: "Kallyanpur, Mirpur Road, Dhaka" },
      { name: "Mirpur 10 Bus Stand", address: "Mirpur-10, Dhaka-1216" },
      { name: "Mirpur 1 Bus Stand", address: "Mirpur-1, Dhaka-1216" },
      { name: "Mirpur 11 Bus Stand", address: "Mirpur-11, Dhaka-1216" },
      { name: "Mirpur 12 Bus Stand", address: "Mirpur-12, Dhaka" },
      { name: "Mirpur 14 Counter", address: "Mirpur-14, Dhaka" },
      { name: "Technical More Bus Stand", address: "Technical Mor, Mirpur, Dhaka" },
      { name: "Shewrapara Bus Stand", address: "Shewrapara, Mirpur, Dhaka" },
      { name: "Farmgate Bus Stop", address: "Farmgate, Dhaka-1215" },
      { name: "Shahbag Bus Stop", address: "Shahbag, Dhaka-1000" },
      { name: "Science Lab Bus Stop", address: "New Market, Science Lab, Dhaka" },
      { name: "Dhanmondi Bus Stand", address: "Dhanmondi-27, Dhaka-1205" },
      { name: "Asad Gate Bus Stand", address: "Asad Gate, Mohammadpur, Dhaka" },
      { name: "Mohammadpur Bus Stand", address: "Mohammadpur, Dhaka-1207" },
      { name: "Jatrabari Bus Stand", address: "Jatrabari, Dhaka-1204" },
      { name: "Gulistan Bus Terminal", address: "Gulistan, Dhaka-1000" },
      { name: "Arambagh Bus Stop", address: "Arambagh, Motijheel, Dhaka" },
      { name: "Kamalapur Bus Stand", address: "Kamalapur, Dhaka-1000" },
      { name: "Badda Bus Stand", address: "Badda, Dhaka-1212" },
      { name: "Rampura Bridge Bus Stop", address: "Rampura, Dhaka-1219" },
      { name: "Uttara Bus Stand", address: "Uttara, Dhaka-1230" },
      { name: "Airport Bus Stand", address: "Airport Road, Dhaka-1229" },
      { name: "Tongi Bus Stand", address: "Tongi, Gazipur, Dhaka" },
      { name: "Banani Bus Stop", address: "Banani, Dhaka-1213" },
      { name: "Gulshan Bus Stop", address: "Gulshan-2, Dhaka-1212" },
      { name: "Tejgaon Bus Stand", address: "Tejgaon Industrial Area, Dhaka" },
      { name: "Motijheel Bus Stand", address: "Motijheel C/A, Dhaka-1000" },
      { name: "Sadarghat Bus Terminal", address: "Sadarghat, Old Dhaka" },
      { name: "Postogola Bus Stand", address: "Postogola, South Dhaka" },
      { name: "Demra Bus Stand", address: "Demra, Dhaka" },
      { name: "Mugda Bus Stand", address: "Mugda, Dhaka" },
      { name: "Malibagh Bus Stop", address: "Malibagh, Dhaka-1217" },
      { name: "Mouchak Bus Stand", address: "Mouchak, Dhaka" },
      { name: "Paltan Bus Stop", address: "Paltan, Dhaka-1000" },
      { name: "Hazrat Shah Jalal Mazar", address: "Airport Road, Dhaka" },
      { name: "Hemayetpur Bus Point", address: "Hemayetpur Counter, Nabil" },
      { name: "Aminbazar Bus Stand", address: "Aminbazar, Savar, Dhaka" },
    ],
    Gazipur: [
      { name: "Gazipur Chowrasta", address: "Gazipur Chowrasta, Gazipur" },
      { name: "Chandra Bus Point", address: "Chandra, Kaliakair, Gazipur" },
      { name: "Konabari Bus Stand", address: "Konabari, Gazipur" },
      { name: "Board Bazar Bus Stand", address: "Board Bazar, Gazipur" },
      { name: "Joydebpur Bus Stand", address: "Joydebpur, Gazipur" },
      { name: "Kaliakair Bus Stand", address: "Kaliakair, Gazipur" },
      { name: "Sreepur Bus Stand", address: "Sreepur, Gazipur" },
      { name: "Kapasia Bus Stand", address: "Kapasia, Gazipur" },
    ],
    Manikganj: [
      { name: "Manikganj Bus Stand", address: "Manikganj Sadar, Manikganj" },
      { name: "Aricha Ferry Ghat", address: "Aricha, Manikganj" },
      { name: "Daulatpur Bus Stand", address: "Daulatpur, Manikganj" },
    ],
    Munshiganj: [
      { name: "Munshiganj Bus Stand", address: "Munshiganj Sadar" },
      { name: "Mawa Ferry Ghat", address: "Mawa, Munshiganj" },
      { name: "Sreenagar Bus Stand", address: "Sreenagar, Munshiganj" },
    ],
    Narayanganj: [
      { name: "Narayanganj Bus Stand", address: "Narayanganj Sadar" },
      { name: "Siddhirganj Bus Stand", address: "Siddhirganj, Narayanganj" },
      { name: "Fatullah Bus Stand", address: "Fatullah, Narayanganj" },
      { name: "Sonargaon Bus Stand", address: "Sonargaon, Narayanganj" },
    ],
    Narsingdi: [
      { name: "Narsingdi Bus Stand", address: "Narsingdi Sadar" },
      { name: "Madhabdi Bus Stand", address: "Madhabdi, Narsingdi" },
      { name: "Bhairab Bazar Bus Stand", address: "Bhairab, Kishoreganj" },
    ],
    Tangail: [
      { name: "Tangail Bus Terminal", address: "Tangail Sadar, Tangail" },
      { name: "Mirzapur Bus Stand", address: "Mirzapur, Tangail" },
      { name: "Elenga Bus Stand", address: "Elenga, Tangail" },
      { name: "Bangabandhu Bridge West", address: "Bangabandhu Bridge, Tangail" },
    ],
    Kishorganj: [
      { name: "Kishoreganj Bus Stand", address: "Kishoreganj Sadar" },
      { name: "Bajitpur Bus Stand", address: "Bajitpur, Kishoreganj" },
      { name: "Bhairab Bazar", address: "Bhairab Bazar, Kishoreganj" },
    ],
    Faridpur: [
      { name: "Faridpur Bus Stand", address: "Faridpur Sadar" },
      { name: "Bhanga Bus Stand", address: "Bhanga, Faridpur" },
      { name: "Nagarkanda Bus Stand", address: "Nagarkanda, Faridpur" },
    ],
    Madaripur: [
      { name: "Madaripur Bus Stand", address: "Madaripur Sadar" },
      { name: "Shibchar Bus Stand", address: "Shibchar, Madaripur" },
    ],
    Gopalganj: [
      { name: "Gopalganj Bus Stand", address: "Gopalganj Sadar" },
      { name: "Tungipara Bus Stand", address: "Tungipara, Gopalganj" },
    ],
    Rajbari: [
      { name: "Rajbari Bus Stand", address: "Rajbari Sadar" },
      { name: "Goalundo Bus Stand", address: "Goalundo, Rajbari" },
    ],
    Shariatpur: [
      { name: "Shariatpur Bus Stand", address: "Shariatpur Sadar" },
      { name: "Zajira Bus Stand", address: "Zajira, Shariatpur" },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CHATTOGRAM DIVISION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Chattogram: {
    Chattogram: [
      { name: "Dampara Bus Terminal", address: "Dampara, Chattogram" },
      { name: "New Bridge Bus Stand", address: "New Bridge, Chattogram" },
      { name: "Kadamtali Bus Stand", address: "Kadamtali, Chattogram" },
      { name: "Oxygen Bus Stand", address: "Oxygen, Bahaddarhat, Chattogram" },
      { name: "Bahaddarhat Bus Terminal", address: "Bahaddarhat, Chattogram" },
      { name: "Muradpur Bus Stand", address: "Muradpur, Chattogram" },
      { name: "GEC More Bus Stop", address: "GEC Circle, Chattogram" },
      { name: "Agrabad Bus Stop", address: "Agrabad, Chattogram" },
      { name: "Laldighi Bus Stop", address: "Laldighi, Chattogram" },
      { name: "Potenga Bus Stand", address: "Potenga, Chattogram" },
      { name: "Halishahar Bus Stand", address: "Halishahar, Chattogram" },
      { name: "Chittagong EPZ Gate", address: "EPZ, South Halishahar, Chattogram" },
      { name: "Sholoshahar Bus Stand", address: "Sholoshahar, Chattogram" },
      { name: "Fouzdarhat Bus Stand", address: "Fouzdarhat, Chattogram" },
      { name: "Sitakunda Bus Stand", address: "Sitakunda, Chattogram" },
      { name: "Kumira Bus Stand", address: "Kumira, Chattogram" },
      { name: "2 No. Gate Bus Stop", address: "2 No. Gate, Chattogram" },
      { name: "Lalkhan Bazar", address: "Lalkhan Bazar, Chattogram" },
      { name: "Chawkbazar Bus Stop", address: "Chawkbazar, Chattogram" },
    ],
    "Cox's Bazar": [
      { name: "Cox's Bazar Bus Terminal", address: "Central Bus Stand, Cox's Bazar" },
      { name: "Kolatoli Bus Stand", address: "Kolatoli, Cox's Bazar" },
      { name: "Cox's Bazar Bypass Road", address: "Bypass Road, Cox's Bazar" },
      { name: "Teknaf Bus Stand", address: "Teknaf, Cox's Bazar" },
      { name: "Ukhia Bus Stand", address: "Ukhia, Cox's Bazar" },
      { name: "Ramu Bus Stand", address: "Ramu, Cox's Bazar" },
      { name: "Chakaria Bus Stand", address: "Chakaria, Cox's Bazar" },
      { name: "Maheshkhali Ferry Ghat", address: "Maheshkhali, Cox's Bazar" },
    ],
    Comilla: [
      { name: "Comilla Bus Terminal", address: "Comilla Sadar, Comilla" },
      { name: "Comilla Kandirpar", address: "Kandirpar, Comilla" },
      { name: "Comilla Tomsom Bridge", address: "Tomsom Bridge, Comilla" },
      { name: "Daudkandi Bus Stand", address: "Daudkandi, Comilla" },
      { name: "Laksam Bus Stand", address: "Laksam, Comilla" },
      { name: "Chandina Bus Stand", address: "Chandina, Comilla" },
    ],
    Noakhali: [
      { name: "Noakhali Bus Stand", address: "Maijdee Court, Noakhali" },
      { name: "Sonapur Bus Stand", address: "Sonapur, Noakhali" },
      { name: "Begumganj Bus Stand", address: "Begumganj, Noakhali" },
    ],
    Feni: [
      { name: "Feni Bus Stand", address: "Feni Sadar, Feni" },
      { name: "Feni Trunk Road Counter", address: "Trunk Road, Feni" },
      { name: "Mahipal Bus Stand", address: "Mahipal, Feni" },
    ],
    Lakshmipur: [
      { name: "Lakshmipur Bus Stand", address: "Lakshmipur Sadar" },
    ],
    Chandpur: [
      { name: "Chandpur Bus Stand", address: "Chandpur Sadar" },
      { name: "Chandpur Launch Ghat", address: "Launch Ghat, Chandpur" },
    ],
    Brahmanbaria: [
      { name: "Brahmanbaria Bus Stand", address: "B.Baria Sadar" },
      { name: "Ashuganj Bus Stand", address: "Ashuganj, B.Baria" },
    ],
    Rangamati: [
      { name: "Rangamati Bus Stand", address: "Rangamati Sadar" },
    ],
    Bandarban: [
      { name: "Bandarban Bus Stand", address: "Bandarban Sadar" },
    ],
    Khagrachhari: [
      { name: "Khagrachhari Bus Stand", address: "Khagrachhari Sadar" },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SYLHET DIVISION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sylhet: {
    Sylhet: [
      { name: "Sylhet Kumargaon Bus Terminal", address: "Kumargaon, Sylhet" },
      { name: "Sylhet Kadamtali Bus Stand", address: "Kadamtali, Sylhet" },
      { name: "Sylhet Akhalia Bus Stand", address: "Akhalia, Sylhet" },
      { name: "Sylhet Ambarkhana", address: "Ambarkhana, Sylhet" },
      { name: "Sylhet Zindabazar", address: "Zindabazar, Sylhet" },
      { name: "Sylhet Shibganj", address: "Shibganj, Sylhet" },
      { name: "Sylhet Subhanighat", address: "Subhanighat, Sylhet" },
      { name: "Sylhet Modina Market", address: "Modina Market, Sylhet" },
      { name: "Sylhet Airport Road", address: "Airport Road, Sylhet" },
      { name: "Kean Bridge", address: "Kean Bridge, Sylhet" },
    ],
    Moulvibazar: [
      { name: "Moulvibazar Bus Stand", address: "Moulvibazar Sadar" },
      { name: "Srimangal Bus Stand", address: "Srimangal, Moulvibazar" },
      { name: "Sreemangal Tea Garden", address: "Sreemangal, Moulvibazar" },
      { name: "Kamalganj Bus Stand", address: "Kamalganj, Moulvibazar" },
    ],
    Habiganj: [
      { name: "Habiganj Bus Stand", address: "Habiganj Sadar" },
      { name: "Shayestaganj Bus Stand", address: "Shayestaganj, Habiganj" },
    ],
    Sunamganj: [
      { name: "Sunamganj Bus Stand", address: "Sunamganj Sadar" },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RAJSHAHI DIVISION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Rajshahi: {
    Rajshahi: [
      { name: "Rajshahi Bus Terminal", address: "Bus Terminal, Rajshahi" },
      { name: "Rajshahi New Market", address: "New Market, Rajshahi" },
      { name: "Rajshahi Zero Point", address: "Zero Point, Rajshahi" },
      { name: "Rajshahi Shaheb Bazar", address: "Shaheb Bazar, Rajshahi" },
      { name: "Rajshahi Laxmipur", address: "Laxmipur, Rajshahi" },
    ],
    Bogra: [
      { name: "Bogra Bus Terminal", address: "Bogra Sadar, Bogura" },
      { name: "Bogra Satmatha", address: "Satmatha, Bogura" },
      { name: "Bogra Rangpur Road", address: "Rangpur Road, Bogura" },
      { name: "Sherpur Bus Stand (Bogra)", address: "Sherpur, Bogura" },
      { name: "Nandigram Bus Stand", address: "Nandigram, Bogura" },
    ],
    Natore: [
      { name: "Natore Bus Stand", address: "Natore Sadar" },
      { name: "Baraigram Bus Stand", address: "Baraigram, Natore" },
    ],
    Naogaon: [
      { name: "Naogaon Bus Stand", address: "Naogaon Sadar" },
    ],
    Chapainawabganj: [
      { name: "Chapainawabganj Bus Stand", address: "Chapainawabganj Sadar" },
      { name: "Shibganj Bus Stand (Chapai)", address: "Shibganj, Chapainawabganj" },
    ],
    Pabna: [
      { name: "Pabna Bus Stand", address: "Pabna Sadar" },
      { name: "Ishwardi Bus Stand", address: "Ishwardi, Pabna" },
      { name: "Pakshi Bus Stand", address: "Pakshi, Pabna" },
    ],
    Sirajganj: [
      { name: "Sirajganj Bus Stand", address: "Sirajganj Sadar" },
      { name: "Bangabandhu Bridge East", address: "Bangabandhu Bridge, Sirajganj" },
      { name: "Enayetpur Bus Stand", address: "Enayetpur, Sirajganj" },
    ],
    Joypurhat: [
      { name: "Joypurhat Bus Stand", address: "Joypurhat Sadar" },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // KHULNA DIVISION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Khulna: {
    Khulna: [
      { name: "Khulna Bus Terminal (Sonadanga)", address: "Sonadanga, Khulna" },
      { name: "Khulna Rupsha Bus Stand", address: "Rupsha, Khulna" },
      { name: "Khulna Shibbari", address: "Shibbari More, Khulna" },
      { name: "Khulna Feryghat", address: "Feryghat, Khulna" },
      { name: "Khulna Daulatpur Bus Stand", address: "Daulatpur, Khulna" },
      { name: "Phultala Bus Stand", address: "Phultala, Khulna" },
    ],
    Jessore: [
      { name: "Jessore Bus Terminal", address: "Jessore Sadar" },
      { name: "Jessore Monihar", address: "Monihar More, Jessore" },
      { name: "Jessore Rail Station Road", address: "Rail Station Road, Jessore" },
      { name: "Benapole Bus Stand", address: "Benapole, Jessore" },
    ],
    Satkhira: [
      { name: "Satkhira Bus Stand", address: "Satkhira Sadar" },
      { name: "Kalaroa Bus Stand", address: "Kalaroa, Satkhira" },
    ],
    Kushtia: [
      { name: "Kushtia Bus Stand", address: "Kushtia Sadar" },
      { name: "Islamic University Gate", address: "Islamic University, Kushtia" },
    ],
    Meherpur: [
      { name: "Meherpur Bus Stand", address: "Meherpur Sadar" },
    ],
    Chuadanga: [
      { name: "Chuadanga Bus Stand", address: "Chuadanga Sadar" },
    ],
    Jhenaidah: [
      { name: "Jhenaidah Bus Stand", address: "Jhenaidah Sadar" },
    ],
    Narail: [
      { name: "Narail Bus Stand", address: "Narail Sadar" },
    ],
    Magura: [
      { name: "Magura Bus Stand", address: "Magura Sadar" },
    ],
    Bagerhat: [
      { name: "Bagerhat Bus Stand", address: "Bagerhat Sadar" },
      { name: "Mongla Bus Stand", address: "Mongla Port, Bagerhat" },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BARISHAL DIVISION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Barishal: {
    Barishal: [
      { name: "Barishal Bus Terminal (Nathullabad)", address: "Nathullabad, Barishal" },
      { name: "Barishal Rupatali Bus Stand", address: "Rupatali, Barishal" },
      { name: "Barishal Launch Ghat", address: "Launch Ghat, Barishal" },
      { name: "Barishal Notun Bazar", address: "Notun Bazar, Barishal" },
    ],
    Patuakhali: [
      { name: "Patuakhali Bus Stand", address: "Patuakhali Sadar" },
      { name: "Kuakata Bus Stand", address: "Kuakata, Patuakhali" },
    ],
    Bhola: [
      { name: "Bhola Bus Stand", address: "Bhola Sadar" },
    ],
    Pirojpur: [
      { name: "Pirojpur Bus Stand", address: "Pirojpur Sadar" },
    ],
    Barguna: [
      { name: "Barguna Bus Stand", address: "Barguna Sadar" },
    ],
    Jhalokati: [
      { name: "Jhalokati Bus Stand", address: "Jhalokati Sadar" },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RANGPUR DIVISION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Rangpur: {
    Rangpur: [
      { name: "Rangpur Central Bus Terminal", address: "Central Bus Terminal, Rangpur" },
      { name: "Rangpur Shapla Chattar", address: "Shapla Chattar, Rangpur" },
      { name: "Rangpur Jahaj Company More", address: "Jahaj Company More, Rangpur" },
      { name: "Rangpur Dhap Bus Stand", address: "Dhap, Rangpur" },
      { name: "Rangpur Mahiganj Bus Stand", address: "Mahiganj, Rangpur" },
    ],
    Dinajpur: [
      { name: "Dinajpur Bus Terminal", address: "Bus Terminal, Dinajpur" },
      { name: "Dinajpur Pulhat Bus Stand", address: "Pulhat, Dinajpur" },
      { name: "Dinajpur Balubari", address: "Balubari, Dinajpur" },
      { name: "Phulbari Bus Stand", address: "Phulbari, Dinajpur" },
    ],
    Thakurgaon: [
      { name: "Thakurgaon Bus Stand", address: "Thakurgaon Sadar" },
    ],
    Panchagarh: [
      { name: "Panchagarh Bus Stand", address: "Panchagarh Sadar" },
      { name: "Tetulia Bus Stand", address: "Tetulia, Panchagarh" },
    ],
    Kurigram: [
      { name: "Kurigram Bus Stand", address: "Kurigram Sadar" },
    ],
    Gaibandha: [
      { name: "Gaibandha Bus Stand", address: "Gaibandha Sadar" },
      { name: "Bonarpara Bus Stand", address: "Bonarpara, Gaibandha" },
    ],
    Nilphamari: [
      { name: "Nilphamari Bus Stand", address: "Nilphamari Sadar" },
      { name: "Saidpur Bus Stand", address: "Saidpur, Nilphamari" },
    ],
    Lalmonirhat: [
      { name: "Lalmonirhat Bus Stand", address: "Lalmonirhat Sadar" },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MYMENSINGH DIVISION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Mymensingh: {
    Mymensingh: [
      { name: "Mymensingh Bus Stand", address: "Mymensingh Sadar" },
      { name: "Mymensingh Maskanda Bus Stand", address: "Maskanda, Mymensingh" },
      { name: "Mymensingh Town Hall", address: "Town Hall More, Mymensingh" },
      { name: "Trishal Bus Stand", address: "Trishal, Mymensingh" },
      { name: "Bhaluka Bus Stand", address: "Bhaluka, Mymensingh" },
    ],
    Jamalpur: [
      { name: "Jamalpur Bus Stand", address: "Jamalpur Sadar" },
      { name: "Sherpur Bus Stand", address: "Sherpur Sadar" },
    ],
    Netrokona: [
      { name: "Netrokona Bus Stand", address: "Netrokona Sadar" },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MAJOR HIGHWAY POINTS & JUNCTIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Highway: {
    "Dhaka–Chittagong Highway": [
      { name: "Kanchpur Bridge Bus Stop", address: "Kanchpur Bridge, Narayanganj" },
      { name: "Meghna Bridge Bus Stop", address: "Meghna Bridge, Comilla" },
      { name: "Daudkandi Bus Point", address: "Daudkandi, Comilla" },
      { name: "Feni Mahipal", address: "Mahipal, Feni" },
      { name: "Mirsharai Bus Stand", address: "Mirsharai, Chattogram" },
    ],
    "Dhaka–Sylhet Highway": [
      { name: "Narsingdi Highway Point", address: "Narsingdi, Dhaka-Sylhet Highway" },
      { name: "Bhairab Bypass", address: "Bhairab Bypass, Kishoreganj" },
      { name: "Habiganj Highway Point", address: "Habiganj, Dhaka-Sylhet Highway" },
      { name: "Shayestaganj Bypass", address: "Shayestaganj, Habiganj" },
    ],
    "Dhaka–Rajshahi Highway": [
      { name: "Savar Bus Point", address: "Savar Bus Station, Dhaka" },
      { name: "Nabinagar Bus Point", address: "Nabinagar, Dhaka" },
      { name: "Sreepur Bus Point", address: "Hazi Abdul Motaleb Mondol Market, Sreepur" },
      { name: "Baipail Bus Point", address: "Baipail, Dhaka" },
      { name: "Baipail Shohoz Point", address: "Baipail, Dhaka" },
      { name: "Jerani Bazar_Nabil", address: "Savar, Jerani Bazar" },
      { name: "Fulbari (Savar) Bus Point", address: "Rajfulbaria, Savar Dhaka" },
      { name: "Chandra Bus Point", address: "Chandra, Kaliakair, Gazipur" },
      { name: "Tangail Bypass Bus Stand", address: "Tangail Bypass, Tangail" },
      { name: "Elenga Bus Stand", address: "Elenga, Tangail" },
      { name: "Bangabandhu Bridge Bus Stand", address: "Bangabandhu Bridge" },
      { name: "Hatikumrul Bus Stand", address: "Hatikumrul, Sirajganj" },
      { name: "Bonarpara Bus Stand", address: "Bonarpara, Natore-Bogra" },
      { name: "Natore Bus Stand", address: "Natore, Rajshahi Highway" },
    ],
    "Dhaka–Khulna Highway": [
      { name: "Mawa Bus Stand", address: "Mawa, Munshiganj" },
      { name: "Padma Bridge Point (Mawa)", address: "Padma Bridge, Mawa Side" },
      { name: "Padma Bridge Point (Jajira)", address: "Padma Bridge, Jajira Side" },
      { name: "Bhanga Bus Stand", address: "Bhanga, Faridpur" },
      { name: "Magura Bus Point", address: "Magura, Dhaka-Khulna Highway" },
    ],
    "Dhaka–Mymensingh Highway": [
      { name: "Tongi Bus Stand", address: "Tongi, Gazipur" },
      { name: "Gazipur Chowrasta", address: "Gazipur" },
      { name: "Bhaluka Bus Stand", address: "Bhaluka, Mymensingh" },
    ],
    "N1 – N8 Junctions": [
      { name: "Joydebpur Chowrasta", address: "Joydebpur, Gazipur" },
      { name: "Hatikumrul Junction", address: "Hatikumrul, Sirajganj" },
      { name: "Bogra Bypass", address: "Bogra Bypass, Bogura" },
      { name: "Rangpur Bypass", address: "Rangpur Bypass, Rangpur" },
    ],
  },
};

// ─── Flatten into a single searchable array ────────────────────────────
function buildLocationList(): BDLocation[] {
  const locations: BDLocation[] = [];
  for (const [division, districts] of Object.entries(locationData)) {
    for (const [district, points] of Object.entries(districts)) {
      for (const point of points) {
        locations.push({
          name: point.name,
          address: point.address,
          division,
          district,
        });
      }
    }
  }
  return locations;
}

export const BD_LOCATIONS: BDLocation[] = buildLocationList();

/**
 * Search locations by query string. Matches against name, address, district, and division.
 * Returns up to `limit` results sorted by relevance.
 */
export function searchLocations(query: string, limit: number = 15): BDLocation[] {
  if (!query || !query.trim()) return [];
  
  const terms = query.toLowerCase().trim().split(/\s+/);
  
  const scored = BD_LOCATIONS.map(loc => {
    const nameL = loc.name.toLowerCase();
    const addrL = loc.address.toLowerCase();
    const distL = loc.district.toLowerCase();
    const divL = loc.division.toLowerCase();
    const combined = `${nameL} ${addrL} ${distL} ${divL}`;
    
    let score = 0;
    let allMatch = true;
    
    for (const term of terms) {
      if (!combined.includes(term)) {
        allMatch = false;
        break;
      }
      // Higher weight for name matches
      if (nameL.includes(term)) score += 10;
      // Bonus for starts-with on name
      if (nameL.startsWith(term)) score += 5;
      // Address matches
      if (addrL.includes(term)) score += 3;
      // District/division matches
      if (distL.includes(term)) score += 2;
      if (divL.includes(term)) score += 1;
    }
    
    return { loc, score, allMatch };
  })
  .filter(item => item.allMatch && item.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, limit);
  
  return scored.map(s => s.loc);
}

/**
 * Get all unique divisions
 */
export function getDivisions(): string[] {
  return [...new Set(BD_LOCATIONS.map(l => l.division))];
}

/**
 * Get all unique districts for a given division
 */
export function getDistricts(division: string): string[] {
  return [...new Set(BD_LOCATIONS.filter(l => l.division === division).map(l => l.district))];
}
