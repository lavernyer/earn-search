FROM apify/actor-node-puppeteer

COPY . ./

RUN npm install --quiet --only=prod --no-optional \
  && npm list

CMD [ "node", "main.js" ]