import { readDividendRecords } from "../src/lib/dividends";

async function main() {
  await readDividendRecords();
}

main()
  .then(() => {
    console.log("Seed complete");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
