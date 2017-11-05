const Apify = require('apify');
const puppeteer = require('puppeteer');
const { typeCheck } = require('type-check');

const { log, dir } = console;

const INPUT_TYPE = `{
  searchQuery: String
}`;

async function scrollDown(page, userCount) {
  try {
    await page.evaluate(async maxCount => (
      new Promise((resolve, reject) => {
        try {
          let maxIntervals = 1000;
          let repetitiveCount = 100;
          let previousCount = null;

          const interval = setInterval(() => {
            window.scrollBy(0, document.body.offsetHeight - 100);
            const users = document.querySelectorAll('.landing-vip');
            const currentCount = users.length;
            if (currentCount < maxCount && maxIntervals > 0 && repetitiveCount > 0) {
              if (previousCount === currentCount) {
                console.log('Countdown if over: ', repetitiveCount);
                repetitiveCount -= 1;
              } else {
                console.log('Current count:', currentCount);
                repetitiveCount = 100;
              }
              maxIntervals -= 1;
              previousCount = currentCount;
            } else {
              clearInterval(interval);
              resolve();
            }
          }, 3000);
        } catch (error) {
          reject(error);
        }
      })
    ), userCount);
  } catch (error) {
    log('Error while scrolling:', error);
  } finally {
    log('Scrolling finished.');
  }
}

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
    headless: true,
    timeout: 0,
  });
  log('New browser window opened.');

  log('Openning new page...');
  const page = await browser.newPage();

  page.on('request', (request) => {
    if (request.method === 'OPTIONS') {
      log(request.url);
    }
  });

  page.on('console', (message) => {
    log(message.text);
  });

  log(`Going to ${searchPageUrl}`);
  await page.goto(searchPageUrl, { waitUntil: 'networkidle', timeout: 0 });

  log('Typing search query:', searchQuery);
  await page.type('input', searchQuery);
  await page.click('.c21-btn.btn-search');

  await page.waitForSelector('.list-search-results');

  const maxCount = await page.evaluate(() => {
    const allResults = document.querySelector('.list-search-title-button');
    return Number(allResults.textContent.replace(/\D/g, ''));
  });
  log(maxCount);

  await scrollDown(page, 50);

  await page.addStyleTag({
    content: `
      .c21 .landing-grid-vip {
        display: none;
      }
      .c21 .pagination-load-more {
        margin: 0 !important;
        padding: 100px;
        top: 100vh;
      }
    `,
  });

  await scrollDown(page, maxCount);

  log('Extracting user data...');
  const allUserResults = await page.evaluate(() => {
    const allUsers = document.querySelectorAll('.landing-vip');
    console.log(allUsers, allUsers.length);
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

  log('Extracted results number of users: ', allUserResults.length);

  log('Setting OUTPUT result...');
  const output = {
    searchQuery,
    resultsLength: allUserResults.length,
    searchResult: allUserResults,
  };
  await Apify.setValue('OUTPUT', output);

  log('Closing browser window.');
  await browser.close();
});
