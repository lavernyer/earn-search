const Apify = require('apify');
const puppeteer = require('puppeteer');
const { typeCheck } = require('type-check');

const { log, dir } = console;

const INPUT_TYPE = `{
  searchQuery: String
}`;

Apify.main(async () => {
  const input = await Apify.getValue('INPUT');
  if (!typeCheck(INPUT_TYPE, input)) {
    log('Expected input:');
    log(INPUT_TYPE);
    log('Received input:');
    dir(input);
    throw new Error('Received invalid input');
  }
  const { searchQuery } = input;
  const searchPageUrl = 'https://earn.com/search/';

  log('Openning browser...');
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    headless: !!process.env.APIFY_HEADLESS,
    timeout: 0,
  });
  log('New browser window opened.');

  log('Openning new page...');
  const page = await browser.newPage();

  log(`Going to ${searchPageUrl}`);
  await page.goto(searchPageUrl, { waitUntil: 'networkidle', timeout: 0 });

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
          let lastScroll = 0;
          const interval = setInterval(() => {
            window.scrollBy(0, document.body.offsetHeight);
            const { scrollTop } = document.documentElement;
            if (scrollTop === lastScroll) {
              clearInterval(interval);
              resolve();
            } else {
              lastScroll = scrollTop;
            }
          }, 3000);
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

  log('Extracting user data...');
  const allUserResults = await page.evaluate(() => {
    const allUsers = document.querySelectorAll('.landing-vip.visible .content');
    return Array.from(allUsers).map((user) => {
      const name = user.querySelector('.name').textContent;
      const tag = user.querySelector('.username').textContent;
      const result = { name, tag };
      const tableElements = Array.from(user.querySelectorAll('.table-icon'));
      tableElements.forEach((element) => {
        const key = element.className.replace('table-icon', '').replace('search-', '');
        Object.assign(result, { [key.trim()]: element.textContent });
      });
      const links = user.querySelectorAll('.profile-social-links > a:not(.disabled)');
      links.forEach((anchor) => {
        const key = anchor.className.replace('social-link-', '').trim();
        Object.assign(result, { [key]: anchor.href });
      });
      return result;
    });
  });

  log('Closing page...');
  await page.close().catch(error => log(`Error closing page: ${error}.`));

  log('Extracted results: ', allUserResults);
  log('Extracted results number of users: ', allUserResults.length);

  log('Setting OUTPUT result...');
  await Apify.setValue('OUTPUT', { searchResult: allUserResults });

  log('Closing browser window.');
  await browser.close();
});
