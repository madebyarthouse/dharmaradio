import type { MetaFunction } from "@remix-run/cloudflare";
import { cacheHeader } from "pretty-cache-header";
import { useLoaderData } from "@remix-run/react";
import Sounds from "~/components/sounds";

export const meta: MetaFunction = () => {
  return [
    { title: "Dharma Radio" },
    {
      name: "description",
      content: "A web player for all talks from dharmaseed.org",
    },
    { name: "og:title", content: "Dharma Radio" },
    {
      name: "og:description",
      content: "A web player for all talks from dharmaseed.org",
    },
    { name: "og:image", content: "https://dharmarad.io/og.png" },
    { name: "og:image:width", content: "1200" },
    { name: "og:image:height", content: "630" },
    { name: "og:image:alt", content: "Dharma Radio" },
    { name: "og:type", content: "website" },
    { name: "og:url", content: "https://dharmarad.io" },
  ];
};

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
  {
    text: "For things to reveal themselves to us, we need to be ready to abandon our views about them.",
    source: "Thich Nhat Hanh, Being Peace",
  },
  {
    text: "Walk as if you are kissing the Earth with your feet.",
    source: "Thich Nhat Hanh, Peace is Every Step",
  },
  {
    text: "It is truth that liberates, not your effort to be free.",
    source: "Jiddu Krishnamurti, The First and Last Freedom",
  },
  {
    text: "Five decades ago, some very kind people in Japan slipped me the secret: you can dramatically extend life – not by multiplying the number of your years, but by expanding the fullness of your moments.",
    source: "Shinzen Young, The Science of Enlightenment",
  },
  {
    text: "Anything you avoid in life will come back, over and over again, until you’re willing to face it—to look deeply into its true nature.",
    source: "Adyashanti, The End of Your World",
  },
  {
    text: "To see a World in a Grain of Sand<br/>And a Heaven in a Wild Flower,<br/>Hold Infinity in the palm of your hand<br/>And Eternity in an hour.",
    source: "William Blake",
  },
  {
    text: "He who binds to himself a joy<br/>Does the winged life destroy;<br/>But he who kisses the joy as it flies<br/>Lives in eternity's sun rise.",
    source: "William Blake",
  },
  {
    text: "Taste this, and be henceforth among the gods<br/>Thyself a goddess, not to Earth confined",
    source: "John Milton, Paradise Lost",
  },
  {
    text: "You are not a drop in the ocean. You are the entire ocean in a drop",
    source: "Rumi",
  },
  {
    text: "Life shrinks or expands in proportion to one’s courage.",
    source: "Anais Nin",
  },
  {
    text: "Enlightenment is when a wave realizes it is the ocean.",
    source: "Thich Nhat Hanh",
  },
];

export const headers = {
  "Cache-Control": cacheHeader({
    maxAge: "15min",
    sMaxage: "3hours",
    staleWhileRevalidate: "1day",
  }),
};

export const loader = async () => {
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  return {
    randomQuote,
  };
};

export default function Home() {
  const { randomQuote } = useLoaderData<typeof loader>();

  return (
    <div className="py-10 px-5 max-w-full md:w-[80ch] mx-auto text-brand flex flex-col items-center">
      <header className="flex gap-2 w-fit max-w-full md:w-[60ch] justify-center items-center flex-col">
        <div className="flex flex-col items-center justify-center gap-1">
          <h1 className="text-4xl font-bold">Dharma Radio</h1>
          <p className="w-full text-balance mt-5 md:w-[40ch] text-center">
            is a <strong>pre-release</strong> web application which makes the
            dharma talks from{" "}
            <a
              target="_blank"
              className="underline underline-offset-2"
              rel="noreferrer"
              href="https://dharmaseed.org"
            >
              Dharma&nbsp;Seed
            </a>{" "}
            more accessible.
          </p>
        </div>
      </header>

      <footer className="max-w-full md:w-[65ch] mx-auto flex text-center flex-col items-center justify-center">
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
              <span className="underline underline-offset-2">dharmarad_io</span>
            </a>
          </p>
        </div>
      </footer>

      <aside>
        <hr className="expanding-line max-w-full bg-transparent transition-all my-3" />
        <Sounds />
        <hr className="expanding-line h-[1px] max-w-full bg-brand transition-all mt-3" />
      </aside>

      <section aria-hidden className="flex items-center justify-center py-10">
        <div className="rounded-full border-4 scale-[0.25] border-brand breath-circle h-[250px] w-[250px]"></div>
      </section>

      <section className="text-center max-w-full text-balance w-[60ch] mx-auto overflow-y-auto">
        <p
          className="italic"
          dangerouslySetInnerHTML={{ __html: `"${randomQuote.text}"` }}
        ></p>
        <p className="mt-1">– {randomQuote.source}</p>
      </section>
    </div>
  );
}
