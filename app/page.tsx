import { AsciiArt } from "./components/AsciiArt";
import { asciiPortrait } from "./components/asciiCharacter.js";
import { SiteHeader } from "./components/SiteChrome";

export default function Home() {
  return (
    <>
      <SiteHeader current="home" />
      <noscript dangerouslySetInnerHTML={{ __html: "<style>#ascii{container-type:inline-size;overflow:hidden}#ascii pre{font-size:min(14px,2cqw);max-width:none;white-space:pre;width:max-content}</style>" }} />
      <main className="page-view page-view--home" data-page-view="home">
        <section className="container mt-4 container-vertical-center" aria-labelledby="home-title">
          <div className="row">
            <div className="col-lg-6 order-lg-2">
              <h1 id="home-title">Yes, my initials spell &quot;hah.&quot;</h1>
              <p>I’m Hayden Howard, a techie from Dayton. I develop and operate resilient systems that people can trust under pressure.</p>
              <p>I live for good cold brew, meaningful work, and passionate people.</p>
            </div>
            <div className="col-lg-6 order-lg-1 ascii-container" id="ascii">
              <AsciiArt art={asciiPortrait} />
            </div>
          </div>
        </section>

        <section className="container mt-4 container-vertical-center" aria-labelledby="qa-title">
          <div className="row qa-columns">
            <div className="col-lg-6 order-lg-2">
              <div>
                <h2 className="pulse-effect text-center" id="qa-title">
                  <span className="signal-fuzz signal-fuzz--pulse">Q &amp; A</span>
                </h2>
                <h3>What is your favorite programming language?</h3>
                <p>C++, though it didn&apos;t usurp Java until my second Systems course, wherein I adopted some of Professor &quot;DJ&quot; Rao&apos;s passion for it. Today, it&apos;s my go-to language for scripting and general coding practice. I admire its efficiency, versatility, and integrative capacity.</p>
                <h3>Do you prefer in-person or remote work?</h3>
                <p>I prefer a hybrid approach. Working remotely helps me focus and get into a productive flow, while in-person collaboration allows for faster and more efficient teamwork.</p>
                <h3>What is your favorite music genre?</h3>
                <p>I listen most often to big band swing, finding it especially easy to slip into a flow state with. I also play acoustic guitar and flute.</p>
                <h3>Dogs or cats?</h3>
                <p>Cats.</p>
                <h3>Why USN Officer Candidate School?</h3>
                <p>Type three fun.</p>
              </div>
            </div>
            <div className="col-lg-6 order-lg-1">
              <div>
                <h3>What is your favorite latte?</h3>
                <p>Naoki fragrant yame blend matcha with traditionally processed whole milk, grade B maple syrup, and either cinnamon or peppermint extract.</p>
                <h3>What have you learned during your education and GLAM-sector &quot;gap&quot;?</h3>
                <ol>
                  <li>How to command attention and order while maintaining both high energy and clarity of thought for several hours at a time.</li>
                  <li>I learn best while teaching others.</li>
                  <li>How to translate ideas presented with moderate formality into extremely informal language so as to reach audiences with differing levels of literacy.</li>
                </ol>
                <h3>What enticed you into the world of coding, data, and analysis?</h3>
                <p>I discovered during self-study of pathophysiology while taking an anatomy and physiology course that I truly enjoy the systematic nature of physiology. My directive became transparent.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
