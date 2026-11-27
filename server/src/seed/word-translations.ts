import type { WordTranslations } from '../db/schema';

/** Column order of the rows below. */
const LOCALES = ['es', 'pt-BR', 'fr', 'de', 'ja', 'ko', 'zh-Hans', 'ru', 'it', 'tr', 'id', 'hi'] as const;

/** One string per locale, so a row with a missing or extra column doesn't compile. */
type StringPer<T extends readonly unknown[]> = { -readonly [K in keyof T]: string };
type Row = StringPer<typeof LOCALES>;

/**
 * What players see for each starting word (src/seed/words.ts), by language. Machine-translated first
 * drafts; correct them in the admin panel (Words), which the seed never overwrites.
 */
// prettier-ignore
const ROWS: Record<string, Row> = {
  // easy
  'chair':          ['silla', 'cadeira', 'chaise', 'Stuhl', '椅子', '의자', '椅子', 'стул', 'sedia', 'sandalye', 'kursi', 'कुर्सी'],
  'cup':            ['taza', 'xícara', 'tasse', 'Tasse', 'カップ', '컵', '杯子', 'чашка', 'tazza', 'fincan', 'cangkir', 'कप'],
  'bottle':         ['botella', 'garrafa', 'bouteille', 'Flasche', 'ボトル', '병', '瓶子', 'бутылка', 'bottiglia', 'şişe', 'botol', 'बोतल'],
  'book':           ['libro', 'livro', 'livre', 'Buch', '本', '책', '书', 'книга', 'libro', 'kitap', 'buku', 'किताब'],
  'clock':          ['reloj', 'relógio', 'horloge', 'Uhr', '時計', '시계', '钟', 'часы', 'orologio', 'saat', 'jam', 'घड़ी'],
  'car':            ['coche', 'carro', 'voiture', 'Auto', '車', '자동차', '汽车', 'машина', 'auto', 'araba', 'mobil', 'कार'],
  'potted plant':   ['planta en maceta', 'planta em vaso', 'plante en pot', 'Topfpflanze', '鉢植え', '화분', '盆栽', 'комнатное растение', 'pianta in vaso', 'saksı bitkisi', 'tanaman pot', 'गमले का पौधा'],
  'laptop':         ['portátil', 'notebook', 'ordinateur portable', 'Laptop', 'ノートパソコン', '노트북', '笔记本电脑', 'ноутбук', 'portatile', 'dizüstü bilgisayar', 'laptop', 'लैपटॉप'],
  'cell phone':     ['teléfono móvil', 'celular', 'téléphone portable', 'Handy', '携帯電話', '휴대폰', '手机', 'мобильный телефон', 'cellulare', 'cep telefonu', 'ponsel', 'मोबाइल फ़ोन'],
  'bowl':           ['cuenco', 'tigela', 'bol', 'Schüssel', 'ボウル', '그릇', '碗', 'миска', 'ciotola', 'kase', 'mangkuk', 'कटोरा'],
  'couch':          ['sofá', 'sofá', 'canapé', 'Sofa', 'ソファ', '소파', '沙发', 'диван', 'divano', 'kanepe', 'sofa', 'सोफ़ा'],
  'bed':            ['cama', 'cama', 'lit', 'Bett', 'ベッド', '침대', '床', 'кровать', 'letto', 'yatak', 'tempat tidur', 'बिस्तर'],
  // medium
  'umbrella':       ['paraguas', 'guarda-chuva', 'parapluie', 'Regenschirm', '傘', '우산', '雨伞', 'зонт', 'ombrello', 'şemsiye', 'payung', 'छाता'],
  'bicycle':        ['bicicleta', 'bicicleta', 'vélo', 'Fahrrad', '自転車', '자전거', '自行车', 'велосипед', 'bicicletta', 'bisiklet', 'sepeda', 'साइकिल'],
  'backpack':       ['mochila', 'mochila', 'sac à dos', 'Rucksack', 'リュック', '배낭', '背包', 'рюкзак', 'zaino', 'sırt çantası', 'ransel', 'बैग'],
  'scissors':       ['tijeras', 'tesoura', 'ciseaux', 'Schere', 'はさみ', '가위', '剪刀', 'ножницы', 'forbici', 'makas', 'gunting', 'कैंची'],
  'teddy bear':     ['oso de peluche', 'urso de pelúcia', 'ours en peluche', 'Teddybär', 'テディベア', '곰 인형', '泰迪熊', 'плюшевый мишка', 'orsacchiotto', 'oyuncak ayı', 'boneka beruang', 'टेडी बियर'],
  'toaster':        ['tostadora', 'torradeira', 'grille-pain', 'Toaster', 'トースター', '토스터', '烤面包机', 'тостер', 'tostapane', 'ekmek kızartma makinesi', 'pemanggang roti', 'टोस्टर'],
  'vase':           ['jarrón', 'vaso de flores', 'vase', 'Vase', '花瓶', '꽃병', '花瓶', 'ваза', 'vaso', 'vazo', 'vas bunga', 'फूलदान'],
  'handbag':        ['bolso', 'bolsa', 'sac à main', 'Handtasche', 'ハンドバッグ', '핸드백', '手提包', 'сумочка', 'borsetta', 'el çantası', 'tas tangan', 'हैंडबैग'],
  'tie':            ['corbata', 'gravata', 'cravate', 'Krawatte', 'ネクタイ', '넥타이', '领带', 'галстук', 'cravatta', 'kravat', 'dasi', 'टाई'],
  'remote':         ['mando a distancia', 'controle remoto', 'télécommande', 'Fernbedienung', 'リモコン', '리모컨', '遥控器', 'пульт', 'telecomando', 'kumanda', 'remote', 'रिमोट'],
  'keyboard':       ['teclado', 'teclado', 'clavier', 'Tastatur', 'キーボード', '키보드', '键盘', 'клавиатура', 'tastiera', 'klavye', 'keyboard', 'कीबोर्ड'],
  'bench':          ['banco', 'banco', 'banc', 'Bank', 'ベンチ', '벤치', '长椅', 'скамейка', 'panchina', 'bank', 'bangku', 'बेंच'],
  // hard
  'fire hydrant':   ['boca de incendios', 'hidrante', 'bouche d’incendie', 'Hydrant', '消火栓', '소화전', '消防栓', 'пожарный гидрант', 'idrante', 'yangın musluğu', 'hidran', 'फ़ायर हाइड्रेंट'],
  'stop sign':      ['señal de stop', 'placa de pare', 'panneau stop', 'Stoppschild', '一時停止の標識', '정지 표지판', '停车标志', 'знак «стоп»', 'segnale di stop', 'dur levhası', 'rambu berhenti', 'स्टॉप साइन'],
  'parking meter':  ['parquímetro', 'parquímetro', 'parcmètre', 'Parkuhr', 'パーキングメーター', '주차 요금기', '停车计时器', 'паркомат', 'parchimetro', 'otopark sayacı', 'meteran parkir', 'पार्किंग मीटर'],
  'skateboard':     ['monopatín', 'skate', 'skateboard', 'Skateboard', 'スケートボード', '스케이트보드', '滑板', 'скейтборд', 'skateboard', 'kaykay', 'papan luncur', 'स्केटबोर्ड'],
  'tennis racket':  ['raqueta de tenis', 'raquete de tênis', 'raquette de tennis', 'Tennisschläger', 'テニスラケット', '테니스 라켓', '网球拍', 'теннисная ракетка', 'racchetta da tennis', 'tenis raketi', 'raket tenis', 'टेनिस रैकेट'],
  'hair drier':     ['secador de pelo', 'secador de cabelo', 'sèche-cheveux', 'Föhn', 'ドライヤー', '헤어드라이어', '吹风机', 'фен', 'asciugacapelli', 'saç kurutma makinesi', 'pengering rambut', 'हेयर ड्रायर'],
  'toothbrush':     ['cepillo de dientes', 'escova de dentes', 'brosse à dents', 'Zahnbürste', '歯ブラシ', '칫솔', '牙刷', 'зубная щётка', 'spazzolino', 'diş fırçası', 'sikat gigi', 'टूथब्रश'],
  'wine glass':     ['copa de vino', 'taça de vinho', 'verre à vin', 'Weinglas', 'ワイングラス', '와인잔', '红酒杯', 'бокал для вина', 'calice da vino', 'şarap kadehi', 'gelas anggur', 'वाइन ग्लास'],
  'motorcycle':     ['moto', 'moto', 'moto', 'Motorrad', 'オートバイ', '오토바이', '摩托车', 'мотоцикл', 'moto', 'motosiklet', 'sepeda motor', 'मोटरसाइकिल'],
  'suitcase':       ['maleta', 'mala', 'valise', 'Koffer', 'スーツケース', '여행가방', '行李箱', 'чемодан', 'valigia', 'bavul', 'koper', 'सूटकेस'],
  // expert
  'traffic light':  ['semáforo', 'semáforo', 'feu de circulation', 'Ampel', '信号機', '신호등', '红绿灯', 'светофор', 'semaforo', 'trafik ışığı', 'lampu lalu lintas', 'ट्रैफ़िक लाइट'],
  'frisbee':        ['frisbee', 'frisbee', 'frisbee', 'Frisbee', 'フリスビー', '프리스비', '飞盘', 'фрисби', 'frisbee', 'frizbi', 'frisbee', 'फ्रिस्बी'],
  'baseball glove': ['guante de béisbol', 'luva de beisebol', 'gant de baseball', 'Baseballhandschuh', '野球グローブ', '야구 글러브', '棒球手套', 'бейсбольная перчатка', 'guantone da baseball', 'beyzbol eldiveni', 'sarung tangan bisbol', 'बेसबॉल दस्ताना'],
  'snowboard':      ['tabla de snowboard', 'prancha de snowboard', 'snowboard', 'Snowboard', 'スノーボード', '스노보드', '滑雪板', 'сноуборд', 'snowboard', 'snowboard', 'papan seluncur salju', 'स्नोबोर्ड'],
  'microwave':      ['microondas', 'micro-ondas', 'micro-ondes', 'Mikrowelle', '電子レンジ', '전자레인지', '微波炉', 'микроволновка', 'microonde', 'mikrodalga fırın', 'microwave', 'माइक्रोवेव'],
  'kite':           ['cometa', 'pipa', 'cerf-volant', 'Drachen', '凧', '연', '风筝', 'воздушный змей', 'aquilone', 'uçurtma', 'layang-layang', 'पतंग'],
  'surfboard':      ['tabla de surf', 'prancha de surfe', 'planche de surf', 'Surfbrett', 'サーフボード', '서핑보드', '冲浪板', 'доска для сёрфинга', 'tavola da surf', 'sörf tahtası', 'papan selancar', 'सर्फ़बोर्ड'],
  'horse':          ['caballo', 'cavalo', 'cheval', 'Pferd', '馬', '말', '马', 'лошадь', 'cavallo', 'at', 'kuda', 'घोड़ा'],
  'bus':            ['autobús', 'ônibus', 'bus', 'Bus', 'バス', '버스', '公交车', 'автобус', 'autobus', 'otobüs', 'bus', 'बस'],
  'boat':           ['barco', 'barco', 'bateau', 'Boot', 'ボート', '보트', '船', 'лодка', 'barca', 'tekne', 'perahu', 'नाव'],
};

/** Translations of a seed word, or none for a word added later in the admin panel. */
export function seedTranslations(label: string): WordTranslations {
  const row = ROWS[label];
  if (!row) return {};
  return Object.fromEntries(LOCALES.map((l, i) => [l, row[i]]));
}
