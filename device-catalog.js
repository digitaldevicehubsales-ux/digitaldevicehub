(() => {
  'use strict';

  const catalog = {
    Apple: [
      'iPhone 17 Pro Max','iPhone 17 Pro','iPhone 17 Air','iPhone 17','iPhone 16 Pro Max','iPhone 16 Pro','iPhone 16 Plus','iPhone 16','iPhone 16e','iPhone 15 Pro Max','iPhone 15 Pro','iPhone 15 Plus','iPhone 15','iPhone 14 Pro Max','iPhone 14 Pro','iPhone 14 Plus','iPhone 14','iPhone 13 Pro Max','iPhone 13 Pro','iPhone 13 mini','iPhone 13','iPhone 12 Pro Max','iPhone 12 Pro','iPhone 12 mini','iPhone 12','iPhone 11 Pro Max','iPhone 11 Pro','iPhone 11','iPhone SE (3rd generation)','iPhone SE (2nd generation)','iPhone XS Max','iPhone XS','iPhone XR','iPhone X','iPhone 8 Plus','iPhone 8',
      'MacBook Air 15-inch','MacBook Air 13-inch','MacBook Pro 16-inch','MacBook Pro 14-inch','iPad Pro 13-inch','iPad Pro 11-inch','iPad Air 13-inch','iPad Air 11-inch','iPad','iPad mini','Apple Watch Ultra','Apple Watch Series 11','Apple Watch Series 10','Apple Watch SE','AirPods Pro','AirPods','AirPods Max'
    ],
    Samsung: [
      'Galaxy S26 Ultra','Galaxy S26+','Galaxy S26','Galaxy S25 Ultra','Galaxy S25+','Galaxy S25','Galaxy S25 Edge','Galaxy S24 Ultra','Galaxy S24+','Galaxy S24','Galaxy S24 FE','Galaxy S23 Ultra','Galaxy S23+','Galaxy S23','Galaxy S23 FE','Galaxy S22 Ultra','Galaxy S22+','Galaxy S22','Galaxy S21 Ultra','Galaxy S21+','Galaxy S21','Galaxy S21 FE','Galaxy Z Fold7','Galaxy Z Flip7','Galaxy Z Fold6','Galaxy Z Flip6','Galaxy Z Fold5','Galaxy Z Flip5','Galaxy A56','Galaxy A55','Galaxy A54','Galaxy A36','Galaxy A35','Galaxy A34','Galaxy A26','Galaxy A25','Galaxy A16','Galaxy A15','Galaxy A06','Galaxy A05','Galaxy M55','Galaxy M35','Galaxy M15','Galaxy Tab S10 Ultra','Galaxy Tab S10+','Galaxy Tab S9 Ultra','Galaxy Tab S9+','Galaxy Tab S9','Galaxy Watch Ultra','Galaxy Watch8','Galaxy Watch7','Galaxy Buds3 Pro','Galaxy Buds3'
    ],
    Google: [
      'Pixel 10 Pro Fold','Pixel 10 Pro XL','Pixel 10 Pro','Pixel 10','Pixel 9 Pro Fold','Pixel 9 Pro XL','Pixel 9 Pro','Pixel 9','Pixel 9a','Pixel 8 Pro','Pixel 8','Pixel 8a','Pixel 7 Pro','Pixel 7','Pixel 7a','Pixel 6 Pro','Pixel 6','Pixel 6a','Pixel 5','Pixel 5a','Pixel 4 XL','Pixel 4','Pixel 4a','Pixel Tablet','Pixel Watch 4','Pixel Watch 3','Pixel Watch 2','Pixel Buds Pro 2','Pixel Buds A-Series'
    ],
    Xiaomi: [
      'Xiaomi 17 Ultra','Xiaomi 17 Pro Max','Xiaomi 17 Pro','Xiaomi 17','Xiaomi 15 Ultra','Xiaomi 15 Pro','Xiaomi 15','Xiaomi 14 Ultra','Xiaomi 14 Pro','Xiaomi 14','Xiaomi 13 Ultra','Xiaomi 13 Pro','Xiaomi 13','Xiaomi 12S Ultra','Xiaomi 12 Pro','Xiaomi 12','Xiaomi 11 Ultra','Xiaomi 11T Pro','Redmi Note 15 Pro+','Redmi Note 15 Pro','Redmi Note 15','Redmi Note 14 Pro+','Redmi Note 14 Pro','Redmi Note 14','Redmi Note 13 Pro+','Redmi Note 13 Pro','Redmi Note 13','Redmi Note 12 Pro+','Redmi Note 12 Pro','Redmi Note 12','Redmi 14C','Redmi 13C','Redmi 12','POCO F7 Ultra','POCO F7 Pro','POCO F7','POCO F6 Pro','POCO F6','POCO X7 Pro','POCO X7','POCO X6 Pro','POCO X6','Xiaomi Pad 7 Pro','Xiaomi Pad 7','Redmi Pad Pro','Xiaomi Watch 2 Pro','Redmi Watch 5','Xiaomi Buds 5 Pro'
    ],
    OnePlus: ['OnePlus 15','OnePlus 13','OnePlus 13R','OnePlus 12','OnePlus 12R','OnePlus 11','OnePlus 10 Pro','OnePlus 10T','OnePlus 9 Pro','OnePlus 9','OnePlus 8 Pro','OnePlus 8T','OnePlus Nord 5','OnePlus Nord 4','OnePlus Nord 3','OnePlus Nord CE4','OnePlus Open','OnePlus Pad 2','OnePlus Watch 3','OnePlus Buds Pro 3'],
    Huawei: ['Huawei Pura 80 Ultra','Huawei Pura 80 Pro','Huawei Pura 80','Huawei Pura 70 Ultra','Huawei Pura 70 Pro','Huawei Pura 70','Huawei Mate 70 Pro+','Huawei Mate 70 Pro','Huawei Mate 70','Huawei Mate 60 Pro+','Huawei Mate 60 Pro','Huawei Mate 60','Huawei nova 13 Pro','Huawei nova 13','Huawei Mate X6','Huawei Mate X5','Huawei MatePad Pro','Huawei Watch GT 5 Pro','Huawei Watch GT 5','Huawei FreeBuds Pro 4'],
    OPPO: ['OPPO Find X8 Ultra','OPPO Find X8 Pro','OPPO Find X8','OPPO Find X7 Ultra','OPPO Find X7','OPPO Find N5','OPPO Find N3','OPPO Find N3 Flip','OPPO Reno14 Pro','OPPO Reno14','OPPO Reno13 Pro','OPPO Reno13','OPPO Reno12 Pro','OPPO Reno12','OPPO A5 Pro','OPPO A3 Pro','OPPO Pad 3 Pro','OPPO Watch X2','OPPO Enco X3'],
    vivo: ['vivo X200 Ultra','vivo X200 Pro','vivo X200','vivo X100 Ultra','vivo X100 Pro','vivo X100','vivo X Fold5','vivo X Fold3 Pro','vivo V50','vivo V40 Pro','vivo V40','vivo V30 Pro','vivo V30','vivo Y300 Pro','vivo Y200','vivo Pad5 Pro','vivo Watch 3'],
    Motorola: ['Motorola Razr Ultra','Motorola Razr+','Motorola Razr','Motorola Edge 60 Pro','Motorola Edge 60','Motorola Edge 50 Ultra','Motorola Edge 50 Pro','Motorola Edge 50 Fusion','Moto G Power','Moto G Stylus','Moto G85','Moto G75','Moto G55','Moto G35','Moto G24'],
    Nothing: ['Phone (3)','Phone (3a) Pro','Phone (3a)','Phone (2)','Phone (2a) Plus','Phone (2a)','Phone (1)','CMF Phone 2 Pro','CMF Phone 1','Ear','Ear (a)','CMF Buds Pro 2','CMF Watch Pro 2'],
    realme: ['realme GT 7 Pro','realme GT 7','realme GT 6','realme 14 Pro+','realme 14 Pro','realme 13 Pro+','realme 13 Pro','realme 12 Pro+','realme 12 Pro','realme C75','realme C67','realme Note 60'],
    HONOR: ['HONOR Magic7 Pro','HONOR Magic7','HONOR Magic6 Pro','HONOR Magic6','HONOR Magic V3','HONOR Magic V2','HONOR 400 Pro','HONOR 400','HONOR 200 Pro','HONOR 200','HONOR X9c','HONOR X8c','HONOR Pad V9','HONOR Watch 5'],
    Sony: ['Xperia 1 VII','Xperia 1 VI','Xperia 1 V','Xperia 5 V','Xperia 10 VII','Xperia 10 VI','Xperia 10 V'],
    ASUS: ['ROG Phone 9 Pro','ROG Phone 9','ROG Phone 8 Pro','ROG Phone 8','Zenfone 12 Ultra','Zenfone 11 Ultra','Zenfone 10','ROG Zephyrus G14','ROG Zephyrus G16','ROG Ally X','ROG Ally'],
    Nokia: ['Nokia G42 5G','Nokia G22','Nokia X30 5G','Nokia C32','Nokia C22','Nokia 2660 Flip'],
    HMD: ['HMD Skyline','HMD Fusion','HMD Pulse Pro','HMD Pulse+','HMD Pulse','HMD Barbie Phone'],
    TECNO: ['PHANTOM V Fold2','PHANTOM V Flip2','CAMON 40 Premier 5G','CAMON 40 Pro 5G','CAMON 40 Pro','CAMON 40','CAMON 30 Premier 5G','CAMON 30 Pro 5G','CAMON 30','POVA 7 Ultra 5G','POVA 7 Pro 5G','POVA 7 5G','SPARK 40 Pro+','SPARK 40 Pro','SPARK 40','SPARK 30 Pro','SPARK 30'],
    Infinix: ['ZERO 40 5G','ZERO 40','NOTE 50 Pro+ 5G','NOTE 50 Pro','NOTE 50','NOTE 40 Pro+ 5G','NOTE 40 Pro 5G','NOTE 40 Pro','NOTE 40','GT 30 Pro','GT 20 Pro','HOT 60 Pro+','HOT 60 Pro','HOT 50 Pro+','HOT 50 Pro','SMART 9'],
    itel: ['itel S25 Ultra','itel S25','itel RS4','itel P65','itel P55 5G','itel A80','itel A70'],
    Dell: ['XPS 13','XPS 14','XPS 16','Inspiron 14','Inspiron 16','Latitude 5450','Latitude 7450','Precision 5690','Alienware m16','Alienware x16'],
    HP: ['Spectre x360 14','OmniBook Ultra Flip 14','OmniBook X 14','EliteBook Ultra','EliteBook 840','ProBook 440','Pavilion Plus 14','Victus 16','OMEN 16','OMEN Transcend 14'],
    Lenovo: ['ThinkPad X1 Carbon','ThinkPad X1 2-in-1','ThinkPad T14','ThinkPad P1','Yoga Slim 7i','Yoga 9i','IdeaPad Slim 5','Legion Pro 7i','Legion 7i','Legion Go'],
    Acer: ['Swift Go 14','Swift X 14','Aspire 5','Aspire 7','Predator Helios 16','Predator Helios Neo 16','Nitro V 15','Chromebook Plus 515'],
    Microsoft: ['Surface Laptop 7','Surface Pro 11','Surface Laptop Studio 2','Surface Go 4','Surface Pro 10','Surface Laptop 6'],
    MSI: ['Titan 18 HX','Raider 18 HX','Stealth 16 AI Studio','Vector 16 HX','Katana 15','Prestige 16 AI Evo','Claw'],
    Razer: ['Blade 14','Blade 16','Blade 18','Barracuda Pro','BlackWidow V4 Pro','DeathAdder V3 Pro'],
    LG: ['LG gram Pro 16','LG gram Pro 17','LG gram 16','LG gram 17','LG UltraGear'],
    Framework: ['Framework Laptop 13','Framework Laptop 16'],
    Amazon: ['Fire Max 11','Fire HD 10','Fire HD 8','Kindle Scribe','Kindle Paperwhite','Kindle'],
    Garmin: ['Fenix 8','Forerunner 970','Forerunner 965','Forerunner 265','Venu 3','Vivoactive 6','Instinct 3'],
    Fitbit: ['Sense 2','Versa 4','Charge 6','Inspire 3','Ace LTE'],
    Bose: ['QuietComfort Ultra Headphones','QuietComfort Headphones','QuietComfort Ultra Earbuds','Ultra Open Earbuds'],
    JBL: ['Tour One M3','Tour Pro 3','Live 770NC','Live Beam 3','Flip 7','Charge 6'],
    Anker: ['Soundcore Liberty 4 Pro','Soundcore Space One Pro','Soundcore Space One','Soundcore Boom 2','Anker Prime Power Bank'],
    Belkin: ['BoostCharge Pro','Auto-Tracking Stand Pro','SoundForm Isolate'],
    Beats: ['Powerbeats Pro 2','Beats Studio Pro','Beats Solo 4','Beats Fit Pro','Beats Studio Buds+'],
    Logitech: ['MX Master 4','MX Master 3S','MX Keys S','G Pro X 2 Lightspeed','G502 X Plus','Brio 4K']
  };

  const normalize = value => String(value || '').trim();
  const brands = () => Object.keys(catalog).sort((a,b) => a.localeCompare(b));
  const models = brand => [...(catalog[normalize(brand)] || [])];

  window.DDH_DEVICE_CATALOG = Object.freeze({ catalog, brands, models });
})();
