(() => {
  'use strict';

  const storageByModel = {
    'iPhone 11':['64 GB','128 GB','256 GB'],
    'iPhone 11 Pro':['64 GB','256 GB','512 GB'],
    'iPhone 11 Pro Max':['64 GB','256 GB','512 GB'],
    'iPhone 12':['64 GB','128 GB','256 GB'],
    'iPhone 12 mini':['64 GB','128 GB','256 GB'],
    'iPhone 12 Pro':['128 GB','256 GB','512 GB'],
    'iPhone 12 Pro Max':['128 GB','256 GB','512 GB'],
    'iPhone 13':['128 GB','256 GB','512 GB'],
    'iPhone 13 mini':['128 GB','256 GB','512 GB'],
    'iPhone 13 Pro':['128 GB','256 GB','512 GB','1 TB'],
    'iPhone 13 Pro Max':['128 GB','256 GB','512 GB','1 TB'],
    'iPhone 14':['128 GB','256 GB','512 GB'],
    'iPhone 14 Plus':['128 GB','256 GB','512 GB'],
    'iPhone 14 Pro':['128 GB','256 GB','512 GB','1 TB'],
    'iPhone 14 Pro Max':['128 GB','256 GB','512 GB','1 TB'],
    'iPhone 15':['128 GB','256 GB','512 GB'],
    'iPhone 15 Plus':['128 GB','256 GB','512 GB'],
    'iPhone 15 Pro':['128 GB','256 GB','512 GB','1 TB'],
    'iPhone 15 Pro Max':['256 GB','512 GB','1 TB'],
    'iPhone 16':['128 GB','256 GB','512 GB'],
    'iPhone 16 Plus':['128 GB','256 GB','512 GB'],
    'iPhone 16 Pro':['128 GB','256 GB','512 GB','1 TB'],
    'iPhone 16 Pro Max':['256 GB','512 GB','1 TB'],
    'iPhone 16e':['128 GB','256 GB','512 GB'],
    'Galaxy S21':['128 GB','256 GB'],
    'Galaxy S21+':['128 GB','256 GB'],
    'Galaxy S21 Ultra':['128 GB','256 GB','512 GB'],
    'Galaxy S22':['128 GB','256 GB'],
    'Galaxy S22+':['128 GB','256 GB'],
    'Galaxy S22 Ultra':['128 GB','256 GB','512 GB','1 TB'],
    'Galaxy S23':['128 GB','256 GB'],
    'Galaxy S23+':['256 GB','512 GB'],
    'Galaxy S23 Ultra':['256 GB','512 GB','1 TB'],
    'Galaxy S24':['128 GB','256 GB'],
    'Galaxy S24+':['256 GB','512 GB'],
    'Galaxy S24 Ultra':['256 GB','512 GB','1 TB'],
    'Galaxy S25':['128 GB','256 GB','512 GB'],
    'Galaxy S25+':['256 GB','512 GB'],
    'Galaxy S25 Ultra':['256 GB','512 GB','1 TB'],
    'Pixel 6':['128 GB','256 GB'],
    'Pixel 6 Pro':['128 GB','256 GB','512 GB'],
    'Pixel 7':['128 GB','256 GB'],
    'Pixel 7 Pro':['128 GB','256 GB','512 GB'],
    'Pixel 8':['128 GB','256 GB'],
    'Pixel 8 Pro':['128 GB','256 GB','512 GB','1 TB'],
    'Pixel 9':['128 GB','256 GB'],
    'Pixel 9 Pro':['128 GB','256 GB','512 GB','1 TB'],
    'Pixel 9 Pro XL':['128 GB','256 GB','512 GB','1 TB']
  };

  const colorsByModel = {
    'iPhone 13':['Pink','Blue','Midnight','Starlight','Red','Green'],
    'iPhone 13 mini':['Pink','Blue','Midnight','Starlight','Red','Green'],
    'iPhone 13 Pro':['Graphite','Gold','Silver','Sierra Blue','Alpine Green'],
    'iPhone 13 Pro Max':['Graphite','Gold','Silver','Sierra Blue','Alpine Green'],
    'iPhone 14':['Midnight','Purple','Starlight','Red','Blue','Yellow'],
    'iPhone 14 Plus':['Midnight','Purple','Starlight','Red','Blue','Yellow'],
    'iPhone 14 Pro':['Space Black','Silver','Gold','Deep Purple'],
    'iPhone 14 Pro Max':['Space Black','Silver','Gold','Deep Purple'],
    'iPhone 15':['Black','Blue','Green','Yellow','Pink'],
    'iPhone 15 Plus':['Black','Blue','Green','Yellow','Pink'],
    'iPhone 15 Pro':['Black Titanium','White Titanium','Blue Titanium','Natural Titanium'],
    'iPhone 15 Pro Max':['Black Titanium','White Titanium','Blue Titanium','Natural Titanium'],
    'iPhone 16':['Black','White','Pink','Teal','Ultramarine'],
    'iPhone 16 Plus':['Black','White','Pink','Teal','Ultramarine'],
    'iPhone 16 Pro':['Black Titanium','White Titanium','Natural Titanium','Desert Titanium'],
    'iPhone 16 Pro Max':['Black Titanium','White Titanium','Natural Titanium','Desert Titanium']
  };

  const genericStorage = {
    Phones:['32 GB','64 GB','128 GB','256 GB','512 GB','1 TB'],
    Laptops:['128 GB','256 GB','512 GB','1 TB','2 TB','4 TB'],
    Tablets:['32 GB','64 GB','128 GB','256 GB','512 GB','1 TB','2 TB'],
    Wearables:['8 GB','16 GB','32 GB','64 GB'],
    Accessories:[]
  };
  const genericRam = {
    Phones:['2 GB','3 GB','4 GB','6 GB','8 GB','12 GB','16 GB','24 GB'],
    Laptops:['4 GB','8 GB','16 GB','24 GB','32 GB','48 GB','64 GB','96 GB','128 GB'],
    Tablets:['3 GB','4 GB','6 GB','8 GB','12 GB','16 GB'],
    Wearables:[],
    Accessories:[]
  };
  const genericColors=['Black','White','Silver','Gray','Blue','Green','Red','Pink','Purple','Gold','Brown','Other'];

  const list = values => [...new Set((values||[]).filter(Boolean))];
  function storageOptions({category,model}={}) {
    return list(storageByModel[String(model||'')] || genericStorage[String(category||'')] || []);
  }
  function colorOptions({model}={}) {
    return list(colorsByModel[String(model||'')] || genericColors);
  }
  function ramOptions({category}={}) {
    return list(genericRam[String(category||'')] || []);
  }
  function batteryOptions() {
    const values=[];
    for(let n=100;n>=70;n--)values.push(n+'%');
    values.push('Below 70%');
    return values;
  }
  function supportsPhoneIdentity(category){return category==='Phones'}
  function supportsNetwork(category){return category==='Phones'||category==='Tablets'}
  function supportsBattery(category){return ['Phones','Tablets','Wearables'].includes(category)}
  function supportsRam(category){return ['Phones','Laptops','Tablets'].includes(category)}
  function supportsStorage(category){return category!=='Accessories'}

  window.DDH_DEVICE_SPECS=Object.freeze({
    storageOptions,colorOptions,ramOptions,batteryOptions,
    supportsPhoneIdentity,supportsNetwork,supportsBattery,supportsRam,supportsStorage
  });
})();