import Heading from "../ui/heading";
import Sounds from "./sounds";
import Balancer from "react-wrap-balancer";

const quotes = [
  {
    text: "What we make of our life—the sum total of thoughts, emotions, words, and actions that fill the brief interval between birth and death—is our one great creative masterpiece. The beauty and significance of a life well lived consists not in the works we leave behind, or in what history has to say about us. It comes from the quality of conscious experience that infuses our every waking moment, and from the impact we have on others.",
    source: "Culadasa, The Mind Illuminated",
  },
  {
    text: "Now, insight, we have said, cuts that on which dukkha depends. And dukkha depends on craving. Thus, according to our definition, insight is any way of looking that releases craving.",
    source: "Rob Burbea, Seeing That Frees",
  },
  {
    text: "Knock, And He'll open the door<br/>Vanish, And He'll make you shine like the sun<br/>Fall, And He'll raise you to the heavens<br/>Become nothing, And He'll turn you into everything.",
    source: "Rumi",
  },
  {
    text: "Every moment is a fresh beginning.",
    source: "T.S. Eliot",
  },
  {
    text: "The only way to make sense out of change is to plunge into it, move with it, and join the dance.",
    source: "Alan Watts",
  },
  {
    text: "The mind is its own place, and in itself can make a Heaven of Hell, a Hell of Heaven.",
    source: "John Milton, Paradise Lost",
  },
];

export default async function Home() {
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  return (
    <div className="py-10 px-5 max-w-full w-[80ch] mx-auto text-brand flex flex-col items-center">
      <main className="py-5">
        <section className="flex items-center justify-center py-10">
          <div className="rounded-full border-4 scale-[0.25] border-brand breath-circle h-[250px] w-[250px]"></div>
        </section>

        <section className="text-center max-w-full w-[60ch] mx-auto overflow-y-auto">
          <Balancer>
            <p
              className="italic"
              dangerouslySetInnerHTML={{ __html: `"${randomQuote.text}"` }}
            ></p>
            <p className="mt-1">– {randomQuote.source}</p>
          </Balancer>
        </section>

        <section className="flex items-center justify-center py-10">
          <Sounds />
        </section>

        <header className="flex gap-2 justify-center items-center flex-col">
          <div className="w-fit flex flex-col items-center justify-center gap-1">
            <Heading level="h1">Dharma Radio</Heading>
            <Heading level="h3">Coming Soon!</Heading>
          </div>
          <p className="w-[40ch] text-center">
            Dharma Radio is a web application which makes the dharma talks from{" "}
            <a
              target="_blank"
              className="underline underline-offset-2"
              rel="noreferrer"
              href="https://dharmaseed.org"
            >
              Dharma Seed
            </a>{" "}
            more accesible.
          </p>

          <hr className="expanding-line h-[1px] bg-brand transition-all mt-5" />
        </header>

        <footer className="max-w-full w-[65ch] mx-auto flex flex-col items-center justify-center">
          <div className="pt-5 flex items-center justify-center">
            <p className="">
              made by{" "}
              <a
                target="_blank"
                rel="noreferrer"
                href="https://twitter.com/chrcit"
              >
                @<span className="underline underline-offset-2">chrcit</span>
              </a>
            </p>
            <p className="px-2">/</p>
            <p>
              follow{" "}
              <a
                target="_blank"
                rel="noreferrer"
                href="https://twitter.com/dharmarad_io"
              >
                @
                <span className="underline underline-offset-2">
                  dharmarad_io
                </span>
              </a>
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
