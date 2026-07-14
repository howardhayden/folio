import { SiteHeader } from "./components/SiteChrome";
import { AsciiArt } from "./components/AsciiArt";

const asciiArt = String.raw`MMMMMMMMMMMMMMMMMMMKl'.;:'...         .....';oxkkkkOKXNNNNNWWMMNkol:''
MMMMMMMMMMMMMMMMMMW0c. ...            ..,;:oO0Oxdllldk0KKXNNNWWNKOkxdo
MMMMMMMMMMMMMWWMMWk;.              ...':dOOOkdl;'...';::cox0XNNWWMMMMM
MMMMMXo;:ccc:,','.....         .';oxkKNNXKOxl;,;'....,......'lOXNWWWWW
WWWWMWk;,'.........           .';d000Okdl:;'..'.. ...........:kXXXKKKK
0kxONMXxc'..                  .;okxdl:'...........       ....,dKXK0Okk
kdodKWMWXOdc,.................;xKKOkkkkxo;.... ...,'..    ...'cOXKOkxd
OkkO00KXNNWNKOko;''''''''';codONWNNNNNWN0xc,'....'::,'.    ...;xKKOxdd
Okxxdddxxk0KXNNNOc,'',:ldOKNWWWNNNXXXNNW0occoo:'';:;'''.......,coodddd
OOOOOOOOO00KKKXNWN0OO0XWMWWNNNNXXXXXXNNNXOxddo:;:::,.';;;,'.',cdxk0K0k
XXXXXXXNNNNNNNNNNNWWWWWNNXXNNWWWWWWWWWWWMMWKd:,;;::;',::::;;;:ldxxOOkd
NNWWWWWWWWWWMMMMWWWNNNNNNNNWWWMMMMMMMMMMMMMXd:;;;;;,'';ccllc:,''..... 
MMMMMMMMMMMMMMMMMMMWWWWWWWMMMMMMMMMMMMMMMMMN0xo:;;'...';:c:,.         
MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMN0dc;....',;'.           
MMMMMMMMMMMMMMMMMWWMMMMMMMMWWWWWWWWWWMMMMMMMMMMNOc;cdo;..             
MMMMMMMWWWWWWWWWWWWWWWWWWWNNNNNNNNNNWWWWWMMMMMMMWNNW0:.               
MMMMMMWWWNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNWWWMMMMMMW0;.                
MMMMMMMMWWWNWWWNNNNNNNNNNXXXXXXXXXXXXNNNNNNWWWMMW0l.                  
MMMMMMMMMWWWWWWWNNXXXKKK0OOkkkkkkkkOOOO0KKKXXNWWk'                    
MMMWWWWWWWWNNNNNXXK00OOkkkkkkkkkkkOOOOO00KKXWWWO,.                    
NNXK00OOOkkkkkkkkkkxxxxkkOOOO00000000KXNNNNNWMK:.                     
OOOOOkxxdddddxxxxxxkO00KKXXXXNNNNNNNWWMMMMWWMWx.                      
OOkkOO0OkxxkkkOOOO0XNNNNNNNNNNNNWWWWWMMMMMMMMWx.                      
KKK0KKKKK000OkxdxOKXNWWWWWWWNNNWWWMMMMMMMMMMMKc.                      
NXKOOkxdlc;,,,,;;:oOXWMMMMMMWWWMMMMMMMMMMNKXNd.                       
N0l'.....   .......'ckXWMMMMMMMMWNXXNWN0xxkXNo.                       
WNKd;.               .'l0WMMMMW0l;:cc:;;oKWMMK:                       
WWMWXOo,.               .:kXMWOoc;,'',::lxKWXl.                       
NWMMWWWXx;.         .;:;:;'ckd;:ddolc:;,,:lxl.                        
KXWWWWWWWXkc.     .ck0KKKkdc'.,ldxkOxc'...',,.                        
kKWNKOxdodxdl;'..,ok0KX0kxdoc;'...'',;;,,'..                          
dk0xl;'......',;;coxO00Oxkkkxo;..     .,oc.                           
:clc;'..........',,,;coxk0XXXXOdc::;;'.''.                            
:clc'... ..............;dOXNWWWNNNXXKd,..`;

export default function Home() {
  return (
    <>
      <SiteHeader />
      <noscript dangerouslySetInnerHTML={{ __html: "<style>#ascii{container-type:inline-size}#ascii pre{font-size:min(14px,2.6cqw)}</style>" }} />
      <main>
        <section className="container mt-4 container-vertical-center" aria-labelledby="home-title">
          <div className="row">
            <div className="col-lg-6 order-lg-2">
              <h1 id="home-title">Yes, my initials spell &quot;hah.&quot;</h1>
              <p>I’m Hayden Howard, a techie from Dayton. I develop and operate resilient systems that people can trust under pressure.</p>
              <p>I live for good cold brew, meaningful work, and passionate people.</p>
            </div>
            <div className="col-lg-6 order-lg-1 ascii-container" id="ascii">
              <AsciiArt art={asciiArt} />
            </div>
          </div>
        </section>

        <section className="container mt-4 container-vertical-center" aria-labelledby="qa-title">
          <div className="row qa-columns">
            <div className="col-lg-6 order-lg-2">
              <div>
                <h2 className="pulse-effect text-center" id="qa-title">Q &amp; A</h2>
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
