import { AsciiArt } from "./AsciiArt";
import { asciiPortrait } from "./asciiCharacter.js";
import { homeIntroduction, homeQuestions, homeTitle } from "../content/siteContent.js";

function QuestionAnswer({ question, answer }: { question: string; answer: string | readonly string[] }) {
  return (
    <>
      <h3>{question}</h3>
      {Array.isArray(answer) ? (
        <ol>{answer.map((item) => <li key={item}>{item}</li>)}</ol>
      ) : <p>{answer}</p>}
    </>
  );
}

export default function HomeView() {
  return (
    <>
      <noscript dangerouslySetInnerHTML={{ __html: "<style>#ascii{container-type:inline-size;overflow:hidden}#ascii pre{font-size:min(14px,2cqw);max-width:none;white-space:pre;width:max-content}</style>" }} />
      <main className="page-view page-view--home" data-page-view="home" id="view-home" tabIndex={-1}>
        <section className="container mt-4 container-vertical-center" aria-labelledby="home-title">
          <div className="row">
            <div className="col-lg-6 order-lg-2">
              <h1 id="home-title">{homeTitle}</h1>
              {homeIntroduction.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
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
                {homeQuestions.filter(({ column }) => column === 2).map((item) => <QuestionAnswer key={item.question} question={item.question} answer={item.answer} />)}
              </div>
            </div>
            <div className="col-lg-6 order-lg-1">
              <div>
                {homeQuestions.filter(({ column }) => column === 1).map((item) => <QuestionAnswer key={item.question} question={item.question} answer={item.answer} />)}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
