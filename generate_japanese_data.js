const fs = require('fs');
const path = require('path');

const lastNames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '斎藤', '清水'];
const firstNames = ['健一', '翔太', '拓海', '結衣', '陽菜', '美咲', '太郎', '次郎', '花子', '健二', '浩二', '恵子', '直樹', '彩', '里帆', '翼', '亮太', '芽衣', '葵', '陸'];
const questions = [
    '最近ハマっていることは何ですか？',
    'おすすめのランチスポットを教えてください。',
    '週末はどのように過ごしていますか？',
    '好きな本や映画はありますか？',
    '旅行で行ってみたい場所はどこですか？',
    '仕事の合間にリフレッシュする方法は？',
    '得意料理は何ですか？',
    '子供の頃の夢は何でしたか？',
    '今年中に達成したい目標はありますか？',
    '好きな言葉や座右の銘を教えてください。'
];
const targets = ['発表者A', '発表者B', '発表者C', '全体'];

let csvContent = '氏名,質問内容,対象者,除外フラグ\n';

for (let i = 1; i <= 100; i++) {
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const name = `${lastName} ${firstName}`;

    let question = questions[Math.floor(Math.random() * questions.length)];
    // Randomly add line breaks to some questions
    if (i % 4 === 0) {
        question = `"質問 ${i}:\n${question}"`;
    }

    const target = targets[Math.floor(Math.random() * targets.length)];

    let exclusion = '';
    if (i % 15 === 0) exclusion = 'x';
    if (i % 25 === 0) exclusion = '*';

    csvContent += `${name},${question},${target},${exclusion}\n`;
}

const outputPath = path.join('c:\\Users\\TOHNICHI\\木曜会\\Roulette', 'test_japanese_100.csv');
fs.writeFileSync(outputPath, csvContent, 'utf8');

console.log(`Successfully generated 100 entries at: ${outputPath}`);
