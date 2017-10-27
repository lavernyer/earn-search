const puppeteer = require('puppeteer');

const { log } = console;

const searchQuery = 'David';
const searchPageUrl = 'https://21.co/search/';

(async () => {
  log('Openning browser...');
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  log('New browser window opened.');

  log('Openning new page...');
  const page = await browser.newPage();

  log(`Going to ${searchPageUrl}`);
  await page.goto(searchPageUrl, { waitUntil: 'networkidle' });

  log('Typing search query:', searchQuery);
  await page.type('input', searchQuery);
  await page.click('.c21-btn.btn-search');

  await page.waitForSelector('.list-search-results');

  page.on('request', (request) => {
    if (request.method === 'OPTIONS') {
      log(request.url);
    }
  });

  // Scrolling function
  try {
    await page.evaluate(async () => (
      new Promise((resolve, reject) => {
        try {
          const maxScroll = Number.MAX_SAFE_INTEGER;
          let lastScroll = 0;
          const interval = setInterval(() => {
            window.scrollBy(0, document.body.offsetHeight);
            const { scrollTop } = document.documentElement;
            if (scrollTop === maxScroll || scrollTop === lastScroll) {
              clearInterval(interval);
              resolve();
            } else {
              lastScroll = scrollTop;
            }
          }, 1000);
        } catch (error) {
          reject(error);
        }
      })
    ));
  } catch (error) {
    log('Error while scrolling:', error);
  }
  log('Scrolling finished.');

  await page.waitForSelector('.list-search-results');

  log('Closing page...');
  await page.close().catch(error => log(`Error closing page: ${error}.`));

  log('Closing browser window.');
  await browser.close();
})();
