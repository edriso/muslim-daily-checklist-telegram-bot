/**
 * Channel welcome message. Pinned to the channel as the first thing new
 * joiners see. Posted (or updated in place) manually via
 * `scripts/post-welcome.ts`, NOT by the running bot's cron loop.
 *
 * Plain text — no parse_mode (same project-wide rule as the dhikr
 * messages: Arabic + emoji + punctuation render perfectly without
 * Markdown/HTML escaping). Stays ≤ 4096 chars (Telegram single-message
 * limit).
 *
 * If schedule times in `schedules.ts` change, update the times listed
 * here too. There is no auto-sync — the welcome is read once per joiner
 * and pinned, so a stale time here is visible to everyone for a long
 * time. Re-post / re-edit via `pnpm post-welcome` after any change.
 */
export const welcomeMessage = `السلام عليكم ورحمة الله وبركاته 🌿

أهلًا بك في «زادُنا»

قناةٌ هادئةٌ تُعينك على دوامِ ذكر الله:

🌅 أذكار الصباح — 5:30 ص
🕌 سننُ الجمعة — 5:32 ص (الجمعة فقط)
🌇 أذكار المساء — 5:00 م
✨️ تذكير صيام الإثنين والخميس — مساء الأحد والأربعاء
🌙 سورة المُلك وأذكار النوم ونيّة القيام — 9:43 م
📋 استبيان مراجعة الليلة — 9:45 م
(جميع المواعيد بتوقيت القاهرة)

📋 عن استبيان مراجعة الليلة:
كل ليلة نضع تصويتًا بسيطًا: «بماذا أتممتَ يومك؟»، تختار منه ما فعلت.
• تصويتٌ سرّي تمامًا: لا أحد يرى اختيارك، ولا حتى القائمون على القناة. تظهر النِّسَب العامة فقط.
• الغاية ليست أن يراك الناس، بل أن تحاسب نفسك، وأن تطمئن أنك لست وحدك على الطريق.
• ولا تحزن إن فاتك شيء؛ «أحبُّ الأعمالِ إلى اللهِ أدومُها وإن قلّ»، فالعبرة بالدوام لا بالكمال.
• يأتي الاستبيان آخر منشور في النافذة الليلية عمدًا — فإن لم تكن قرأت «سورة المُلك وأذكار النوم» (آخِر بنوده) فاصعد قليلًا فوقه إلى رسالة ما قبل النوم.

📖 الأذكار مرتّبةٌ على نَسَق «حصن المسلم» (الصباح، المساء، النوم) ومأخوذةٌ من نصوصه؛ ولك أن تقرأها من الكتاب أو من تطبيقٍ موثوق إن كان أيسر لك.

🌿 إن انتفعت بها فلا تنسانا من دعائك، وانشرها لإخوانك؛ فالدالُّ على الخيرِ كفاعلِه.

اللهم اجعلها زادًا لنا ولكم إلى يوم نلقاك، وتقبّلها منّا خالصةً لوجهك الكريم.`;
