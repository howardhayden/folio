export const ASCII_COLUMNS = 70;
export const ASCII_ROWS = 34;

export const ASCII_CHARACTER_DESCRIPTION =
  "A person sitting beneath a tree writes on a tablet, turns toward a moving mouse pointer, and occasionally raises a bent arm overhead to swat while keeping a pen in hand.";

export const asciiPortrait = String.raw`MMMMMMMMMMMMMMMMMMMKl'.;:'...         .....';oxkkkkOKXNNNNNWWMMNkol:''
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

/** @typedef {{ row: number, column: number, text: string }} AsciiPatch */
/** @typedef {{ pose: string, durationMs: number }} TimedPose */
/** @typedef {'left' | 'right' | 'upper-left' | 'upper-right'} SwatDirection */
/** @typedef {'blank' | 'image' | 'near-person' | 'person' | 'tablet'} AsciiHit */

/** @type {Readonly<Record<string, readonly AsciiPatch[]>>} */
export const ASCII_POSES = Object.freeze({
  "write-rest": Object.freeze([]),
  "write-left": Object.freeze([
    Object.freeze({ row: 29, column: 38, text: "'..',,,." }),
    Object.freeze({ row: 30, column: 36, text: ",;;,.'.." }),
    Object.freeze({ row: 31, column: 38, text: ".'oc. " }),
  ]),
  "write-center": Object.freeze([
    Object.freeze({ row: 29, column: 38, text: "'...',,." }),
    Object.freeze({ row: 30, column: 36, text: ",;;,,'.." }),
    Object.freeze({ row: 31, column: 38, text: ".,oc. " }),
  ]),
  "write-right": Object.freeze([
    Object.freeze({ row: 29, column: 38, text: "',..',,." }),
    Object.freeze({ row: 30, column: 36, text: ",;,,'..." }),
    Object.freeze({ row: 31, column: 38, text: ",;oc. " }),
  ]),
  "write-pause": Object.freeze([
    Object.freeze({ row: 27, column: 34, text: ",',.,::" }),
    Object.freeze({ row: 29, column: 38, text: "'...',,." }),
    Object.freeze({ row: 31, column: 38, text: ".,oc. " }),
  ]),
  "write-shoulder": Object.freeze([
    Object.freeze({ row: 28, column: 30, text: ";:ddolc;" }),
    Object.freeze({ row: 29, column: 30, text: ";ldxkOxc" }),
    Object.freeze({ row: 30, column: 36, text: ",;;,,'.." }),
  ]),
  "notice-left": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:cc:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
  ]),
  "notice-right": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:cc:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
  ]),
  "notice-upper-left": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "\\MMNKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:^c:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
  ]),
  "notice-upper-right": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "MM/NKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:^c:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
  ]),
  "right-windup": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:cc:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
    Object.freeze({ row: 21, column: 48, text: "(@)=====>" }),
    Object.freeze({ row: 22, column: 49, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 50, text: "OOO\\" }),
    Object.freeze({ row: 24, column: 49, text: "(OOO)" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "right-extend": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:cc:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
    Object.freeze({ row: 19, column: 48, text: "(@)=====>" }),
    Object.freeze({ row: 20, column: 49, text: "OOO\\" }),
    Object.freeze({ row: 21, column: 50, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 51, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 51, text: "(OOO)" }),
    Object.freeze({ row: 24, column: 49, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "right-contact": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:cc:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
    Object.freeze({ row: 18, column: 48, text: "(@)=====>" }),
    Object.freeze({ row: 19, column: 49, text: "OOO\\" }),
    Object.freeze({ row: 20, column: 50, text: "OOO\\" }),
    Object.freeze({ row: 21, column: 51, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 52, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 51, text: "(OOO)" }),
    Object.freeze({ row: 24, column: 49, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "right-recoil": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:cc:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
    Object.freeze({ row: 21, column: 47, text: "(@)=====>" }),
    Object.freeze({ row: 22, column: 48, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 50, text: "OOO\\" }),
    Object.freeze({ row: 24, column: 48, text: "(OOO)" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "upper-right-windup": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "MM/NKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:^c:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
    Object.freeze({ row: 20, column: 48, text: "(@)=====>" }),
    Object.freeze({ row: 21, column: 49, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 50, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 50, text: "(OOO)" }),
    Object.freeze({ row: 24, column: 49, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "upper-right-extend": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "MM/NKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:^c:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
    Object.freeze({ row: 17, column: 48, text: "(@)=====>" }),
    Object.freeze({ row: 18, column: 49, text: "OOO\\" }),
    Object.freeze({ row: 19, column: 50, text: "OOO\\" }),
    Object.freeze({ row: 20, column: 51, text: "OOO\\" }),
    Object.freeze({ row: 21, column: 51, text: "(OOO)" }),
    Object.freeze({ row: 22, column: 50, text: "//OOO" }),
    Object.freeze({ row: 23, column: 48, text: "//OOO" }),
    Object.freeze({ row: 24, column: 46, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "upper-right-contact": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "MM/NKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:^c:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
    Object.freeze({ row: 16, column: 48, text: "(@)=====>" }),
    Object.freeze({ row: 17, column: 49, text: "OOO\\" }),
    Object.freeze({ row: 18, column: 50, text: "OOO\\" }),
    Object.freeze({ row: 19, column: 51, text: "OOO\\" }),
    Object.freeze({ row: 20, column: 52, text: "OOO\\" }),
    Object.freeze({ row: 21, column: 52, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 51, text: "(OOO)" }),
    Object.freeze({ row: 23, column: 49, text: "//OOO" }),
    Object.freeze({ row: 24, column: 47, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "upper-right-recoil": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "MM/NKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:^c:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
    Object.freeze({ row: 20, column: 48, text: "(@)=====>" }),
    Object.freeze({ row: 21, column: 49, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 50, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 50, text: "(OOO)" }),
    Object.freeze({ row: 24, column: 49, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "left-windup": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:cc:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
    Object.freeze({ row: 21, column: 39, text: "(@)=====>" }),
    Object.freeze({ row: 22, column: 41, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 43, text: "OOO\\" }),
    Object.freeze({ row: 24, column: 46, text: "(OOO)" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "left-extend": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:cc:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
    Object.freeze({ row: 19, column: 35, text: "(@)=====>" }),
    Object.freeze({ row: 20, column: 38, text: "OOO\\" }),
    Object.freeze({ row: 21, column: 40, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 42, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 44, text: "(OOO)" }),
    Object.freeze({ row: 24, column: 44, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "left-contact": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:cc:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
    Object.freeze({ row: 18, column: 32, text: "(@)=====>" }),
    Object.freeze({ row: 19, column: 35, text: "OOO\\" }),
    Object.freeze({ row: 20, column: 37, text: "OOO\\" }),
    Object.freeze({ row: 21, column: 39, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 42, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 45, text: "(OOO)" }),
    Object.freeze({ row: 24, column: 44, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "left-recoil": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:cc:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
    Object.freeze({ row: 21, column: 39, text: "(@)=====>" }),
    Object.freeze({ row: 22, column: 41, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 43, text: "OOO\\" }),
    Object.freeze({ row: 24, column: 46, text: "(OOO)" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "upper-left-windup": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "\\MMNKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:^c:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
    Object.freeze({ row: 20, column: 38, text: "(@)=====>" }),
    Object.freeze({ row: 21, column: 40, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 42, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 44, text: "(OOO)" }),
    Object.freeze({ row: 24, column: 44, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "upper-left-extend": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "\\MMNKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:^c:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
    Object.freeze({ row: 17, column: 34, text: "(@)=====>" }),
    Object.freeze({ row: 18, column: 37, text: "OOO\\" }),
    Object.freeze({ row: 19, column: 39, text: "OOO\\" }),
    Object.freeze({ row: 20, column: 41, text: "OOO\\" }),
    Object.freeze({ row: 21, column: 42, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 44, text: "(OOO)" }),
    Object.freeze({ row: 23, column: 44, text: "//OOO" }),
    Object.freeze({ row: 24, column: 43, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "upper-left-contact": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "\\MMNKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:^c:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
    Object.freeze({ row: 16, column: 31, text: "(@)=====>" }),
    Object.freeze({ row: 17, column: 34, text: "OOO\\" }),
    Object.freeze({ row: 18, column: 36, text: "OOO\\" }),
    Object.freeze({ row: 19, column: 38, text: "OOO\\" }),
    Object.freeze({ row: 20, column: 40, text: "OOO\\" }),
    Object.freeze({ row: 21, column: 42, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 44, text: "(OOO)" }),
    Object.freeze({ row: 23, column: 44, text: "//OOO" }),
    Object.freeze({ row: 24, column: 43, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "upper-left-recoil": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "\\MMNKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:^c:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
    Object.freeze({ row: 20, column: 38, text: "(@)=====>" }),
    Object.freeze({ row: 21, column: 40, text: "OOO\\" }),
    Object.freeze({ row: 22, column: 42, text: "OOO\\" }),
    Object.freeze({ row: 23, column: 44, text: "(OOO)" }),
    Object.freeze({ row: 24, column: 44, text: "//OOO" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "recover-left": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:cc:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
    Object.freeze({ row: 22, column: 39, text: "(@)=====>" }),
    Object.freeze({ row: 23, column: 42, text: "OOO\\" }),
    Object.freeze({ row: 24, column: 45, text: "(OOO)" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "recover-right": Object.freeze([
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:cc:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
    Object.freeze({ row: 22, column: 48, text: "(@)=====>" }),
    Object.freeze({ row: 23, column: 49, text: "OOO\\" }),
    Object.freeze({ row: 24, column: 48, text: "(OOO)" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "recover-upper-left": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "\\MMNKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "N\\N0xxkXNo." }),
    Object.freeze({ row: 26, column: 30, text: "W0/;:^c:;;oKWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Oo/;,'<,::lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc\\;,,:lxl." }),
    Object.freeze({ row: 22, column: 39, text: "(@)=====>" }),
    Object.freeze({ row: 23, column: 42, text: "OOO\\" }),
    Object.freeze({ row: 24, column: 45, text: "(OOO)" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
  "recover-upper-right": Object.freeze([
    Object.freeze({ row: 24, column: 38, text: "MM/NKXNd." }),
    Object.freeze({ row: 25, column: 34, text: "NWN0xxkXNo./" }),
    Object.freeze({ row: 26, column: 30, text: "W0l;:^c:;;\\KWMMK:" }),
    Object.freeze({ row: 27, column: 30, text: "Ooc;,'>,:/lxKWXl." }),
    Object.freeze({ row: 28, column: 30, text: ";:ddolc/:;,,:lxl." }),
    Object.freeze({ row: 22, column: 48, text: "(@)=====>" }),
    Object.freeze({ row: 23, column: 49, text: "OOO\\" }),
    Object.freeze({ row: 24, column: 48, text: "(OOO)" }),
    Object.freeze({ row: 25, column: 47, text: "/OOO" }),
  ]),
});

export const ASCII_SEQUENCES = Object.freeze({
  writing: Object.freeze([
    Object.freeze({ pose: "write-rest", durationMs: 1150 }),
    Object.freeze({ pose: "write-left", durationMs: 170 }),
    Object.freeze({ pose: "write-center", durationMs: 170 }),
    Object.freeze({ pose: "write-right", durationMs: 170 }),
    Object.freeze({ pose: "write-center", durationMs: 180 }),
    Object.freeze({ pose: "write-rest", durationMs: 950 }),
    Object.freeze({ pose: "write-pause", durationMs: 360 }),
    Object.freeze({ pose: "write-rest", durationMs: 1250 }),
    Object.freeze({ pose: "write-shoulder", durationMs: 250 }),
    Object.freeze({ pose: "write-rest", durationMs: 1450 }),
  ]),
  notice: Object.freeze({
    left: Object.freeze([
      Object.freeze({ pose: "write-pause", durationMs: 90 }),
      Object.freeze({ pose: "notice-left", durationMs: 280 }),
    ]),
    right: Object.freeze([
      Object.freeze({ pose: "write-pause", durationMs: 90 }),
      Object.freeze({ pose: "notice-right", durationMs: 280 }),
    ]),
    "upper-left": Object.freeze([
      Object.freeze({ pose: "write-pause", durationMs: 90 }),
      Object.freeze({ pose: "notice-upper-left", durationMs: 280 }),
    ]),
    "upper-right": Object.freeze([
      Object.freeze({ pose: "write-pause", durationMs: 90 }),
      Object.freeze({ pose: "notice-upper-right", durationMs: 280 }),
    ]),
  }),
  swat: Object.freeze({
    left: Object.freeze([
      Object.freeze({ pose: "left-windup", durationMs: 135 }),
      Object.freeze({ pose: "left-extend", durationMs: 150 }),
      Object.freeze({ pose: "left-contact", durationMs: 190 }),
      Object.freeze({ pose: "left-recoil", durationMs: 175 }),
    ]),
    right: Object.freeze([
      Object.freeze({ pose: "right-windup", durationMs: 135 }),
      Object.freeze({ pose: "right-extend", durationMs: 150 }),
      Object.freeze({ pose: "right-contact", durationMs: 190 }),
      Object.freeze({ pose: "right-recoil", durationMs: 175 }),
    ]),
    "upper-left": Object.freeze([
      Object.freeze({ pose: "upper-left-windup", durationMs: 135 }),
      Object.freeze({ pose: "upper-left-extend", durationMs: 150 }),
      Object.freeze({ pose: "upper-left-contact", durationMs: 190 }),
      Object.freeze({ pose: "upper-left-recoil", durationMs: 175 }),
    ]),
    "upper-right": Object.freeze([
      Object.freeze({ pose: "upper-right-windup", durationMs: 135 }),
      Object.freeze({ pose: "upper-right-extend", durationMs: 150 }),
      Object.freeze({ pose: "upper-right-contact", durationMs: 190 }),
      Object.freeze({ pose: "upper-right-recoil", durationMs: 175 }),
    ]),
  }),
  recover: Object.freeze({
    left: Object.freeze([
      Object.freeze({ pose: "recover-left", durationMs: 170 }),
      Object.freeze({ pose: "write-pause", durationMs: 220 }),
    ]),
    right: Object.freeze([
      Object.freeze({ pose: "recover-right", durationMs: 170 }),
      Object.freeze({ pose: "write-pause", durationMs: 220 }),
    ]),
    "upper-left": Object.freeze([
      Object.freeze({ pose: "recover-upper-left", durationMs: 170 }),
      Object.freeze({ pose: "write-pause", durationMs: 220 }),
    ]),
    "upper-right": Object.freeze([
      Object.freeze({ pose: "recover-upper-right", durationMs: 170 }),
      Object.freeze({ pose: "write-pause", durationMs: 220 }),
    ]),
  }),
});

export const ASCII_SHOULDER = Object.freeze({ row: 25, column: 47 });
export const ASCII_GAZE_ANCHOR = Object.freeze({ row: 26, column: 39 });

/**
 * Authored landmarks keep the gesture reviewable as anatomy rather than as an
 * arbitrary line aimed at the pointer. The hand is above the head, the elbow
 * is displaced far enough to create a real bend, and the pen continues behind
 * the grip toward the portrait's back-right.
 */
export const ASCII_ANATOMY = Object.freeze({
  head: Object.freeze({ top: 24, right: 48, bottom: 28, left: 30 }),
  lowerTorso: Object.freeze({ top: 26, right: 49, bottom: 33, left: 17 }),
  shoulder: ASCII_SHOULDER,
  contact: Object.freeze({
    left: Object.freeze({
      pose: "left-contact",
      hand: Object.freeze({ row: 18, column: 33 }),
      elbow: Object.freeze({ row: 23, column: 47 }),
      penTip: Object.freeze({ row: 18, column: 40 }),
      gazePose: "notice-left",
    }),
    right: Object.freeze({
      pose: "right-contact",
      hand: Object.freeze({ row: 18, column: 49 }),
      elbow: Object.freeze({ row: 23, column: 53 }),
      penTip: Object.freeze({ row: 18, column: 56 }),
      gazePose: "notice-right",
    }),
    "upper-left": Object.freeze({
      pose: "upper-left-contact",
      hand: Object.freeze({ row: 16, column: 32 }),
      elbow: Object.freeze({ row: 22, column: 46 }),
      penTip: Object.freeze({ row: 16, column: 39 }),
      gazePose: "notice-upper-left",
    }),
    "upper-right": Object.freeze({
      pose: "upper-right-contact",
      hand: Object.freeze({ row: 16, column: 49 }),
      elbow: Object.freeze({ row: 22, column: 53 }),
      penTip: Object.freeze({ row: 16, column: 56 }),
      gazePose: "notice-upper-right",
    }),
  }),
});

export const ASCII_REGIONS = Object.freeze({
  tablet: Object.freeze({ top: 28, right: 46, bottom: 32, left: 29 }),
  person: Object.freeze({ top: 23, right: 49, bottom: 33, left: 17 }),
  nearPerson: Object.freeze({ top: 19, right: 57, bottom: 33, left: 11 }),
});

/**
 * @param {string} art
 * @returns {string[]}
 */
export function normalizeAsciiArt(art) {
  if (typeof art !== "string") {
    throw new TypeError("ASCII art must be a string.");
  }

  const normalized = art.replace(/\r\n?/g, "\n");
  if (normalized.includes("\t")) {
    throw new Error("ASCII art must not contain tab characters.");
  }

  const lines = normalized.split("\n");
  if (lines.length !== ASCII_ROWS) {
    throw new Error(
      `ASCII art must contain exactly ${ASCII_ROWS} rows; received ${lines.length}.`,
    );
  }

  return lines.map((line, row) => {
    if (line.length > ASCII_COLUMNS) {
      throw new Error(
        `ASCII row ${row} exceeds ${ASCII_COLUMNS} columns (${line.length}).`,
      );
    }
    return line.padEnd(ASCII_COLUMNS, " ");
  });
}

/**
 * @param {string} art
 * @param {string} poseName
 * @returns {string}
 */
export function applyAsciiPose(art, poseName) {
  const patches = ASCII_POSES[poseName];
  if (!patches) {
    throw new Error(`Unknown ASCII pose: ${poseName}`);
  }

  const grid = normalizeAsciiArt(art).map((line) => Array.from(line));
  for (const patch of patches) {
    const { row, column, text } = patch;
    if (text.includes("\n") || text.includes("\r") || text.includes("\t")) {
      throw new Error(`ASCII pose ${poseName} contains a multiline or tabbed patch.`);
    }
    if (
      row < 0 ||
      row >= ASCII_ROWS ||
      column < 0 ||
      column + text.length > ASCII_COLUMNS
    ) {
      throw new Error(
        `ASCII pose ${poseName} patch exceeds the ${ASCII_COLUMNS}x${ASCII_ROWS} grid.`,
      );
    }
    for (let offset = 0; offset < text.length; offset += 1) {
      grid[row][column + offset] = text[offset];
    }
  }

  return grid.map((line) => line.join("")).join("\n");
}

/**
 * @param {string} art
 * @returns {Record<string, string>}
 */
export function createAsciiFrames(art) {
  return Object.fromEntries(
    Object.keys(ASCII_POSES).map((poseName) => [
      poseName,
      applyAsciiPose(art, poseName),
    ]),
  );
}

/**
 * @param {string[]} lines
 * @param {number} row
 * @param {number} column
 * @param {number} radius
 * @returns {boolean}
 */
function hasInkNearby(lines, row, column, radius) {
  for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
    for (
      let columnOffset = -radius;
      columnOffset <= radius;
      columnOffset += 1
    ) {
      const sampleRow = row + rowOffset;
      const sampleColumn = column + columnOffset;
      if (
        sampleRow >= 0 &&
        sampleRow < ASCII_ROWS &&
        sampleColumn >= 0 &&
        sampleColumn < ASCII_COLUMNS &&
        lines[sampleRow][sampleColumn] !== " "
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * @param {{ top: number, right: number, bottom: number, left: number }} region
 * @param {number} row
 * @param {number} column
 * @returns {boolean}
 */
function isWithinRegion(region, row, column) {
  return (
    row >= region.top &&
    row <= region.bottom &&
    column >= region.left &&
    column <= region.right
  );
}

/**
 * @param {string[]} lines
 * @param {number} row
 * @param {number} column
 * @returns {AsciiHit}
 */
export function classifyAsciiPoint(lines, row, column) {
  if (
    row < 0 ||
    row >= ASCII_ROWS ||
    column < 0 ||
    column >= ASCII_COLUMNS
  ) {
    return "blank";
  }

  if (
    isWithinRegion(ASCII_REGIONS.tablet, row, column) &&
    hasInkNearby(lines, row, column, 1)
  ) {
    return "tablet";
  }

  if (
    isWithinRegion(ASCII_REGIONS.person, row, column) &&
    hasInkNearby(lines, row, column, 1)
  ) {
    return "person";
  }

  if (lines[row][column] !== " " || hasInkNearby(lines, row, column, 1)) {
    return "image";
  }

  if (
    isWithinRegion(ASCII_REGIONS.nearPerson, row, column) &&
    hasInkNearby(lines, row, column, 2)
  ) {
    return "near-person";
  }

  return "blank";
}

/**
 * @param {number} row
 * @param {number} column
 * @returns {SwatDirection}
 */
export function directionForAsciiPoint(row, column) {
  const side = column < ASCII_GAZE_ANCHOR.column ? "left" : "right";
  const isUpper = row <= ASCII_GAZE_ANCHOR.row - 2;
  return isUpper ? `upper-${side}` : side;
}

/**
 * @param {SwatDirection} direction
 * @returns {'left' | 'right'}
 */
export function sideForSwatDirection(direction) {
  return direction.endsWith("left") ? "left" : "right";
}

/**
 * Throws during builds and tests if any pose, patch, region, or sequence can
 * change the portrait's fixed 70x34 geometry.
 *
 * @param {string} [art]
 * @returns {true}
 */
export function validateAsciiCharacterDefinition(art = asciiPortrait) {
  const baseLines = normalizeAsciiArt(art);

  for (const [poseName, patches] of Object.entries(ASCII_POSES)) {
    for (const patch of patches) {
      if (!Number.isInteger(patch.row) || !Number.isInteger(patch.column)) {
        throw new Error(`ASCII pose ${poseName} uses a non-integer patch origin.`);
      }
      if (patch.text.includes("\t")) {
        throw new Error(`ASCII pose ${poseName} contains a tab.`);
      }
    }

    const frameLines = applyAsciiPose(art, poseName).split("\n");
    if (
      frameLines.length !== ASCII_ROWS ||
      frameLines.some((line) => line.length !== ASCII_COLUMNS)
    ) {
      throw new Error(`ASCII pose ${poseName} changes the fixed frame geometry.`);
    }
  }

  /** @param {readonly TimedPose[]} sequence @param {string} label */
  const validateSequence = (sequence, label) => {
    if (!Array.isArray(sequence) || sequence.length === 0) {
      throw new Error(`ASCII sequence ${label} must contain at least one pose.`);
    }
    for (const frame of sequence) {
      if (!ASCII_POSES[frame.pose]) {
        throw new Error(`ASCII sequence ${label} references ${frame.pose}.`);
      }
      if (!Number.isFinite(frame.durationMs) || frame.durationMs <= 0) {
        throw new Error(`ASCII sequence ${label} has an invalid duration.`);
      }
    }
  };

  validateSequence(ASCII_SEQUENCES.writing, "writing");
  for (const [side, sequence] of Object.entries(ASCII_SEQUENCES.notice)) {
    validateSequence(sequence, `notice.${side}`);
  }
  for (const [direction, sequence] of Object.entries(ASCII_SEQUENCES.swat)) {
    validateSequence(sequence, `swat.${direction}`);
  }
  for (const [side, sequence] of Object.entries(ASCII_SEQUENCES.recover)) {
    validateSequence(sequence, `recover.${side}`);
  }

  const directions = ["left", "right", "upper-left", "upper-right"];
  for (const sequenceName of ["notice", "swat", "recover"]) {
    const authoredDirections = Object.keys(ASCII_SEQUENCES[sequenceName]).sort();
    if (authoredDirections.join("|") !== [...directions].sort().join("|")) {
      throw new Error(
        `ASCII ${sequenceName} must author all four pointer directions.`,
      );
    }
  }

  const articulatedPoses = new Set([
    ...Object.values(ASCII_SEQUENCES.swat).flatMap((sequence) =>
      sequence.map(({ pose }) => pose),
    ),
    ...Object.values(ASCII_SEQUENCES.recover).flatMap((sequence) =>
      sequence
        .map(({ pose }) => pose)
        .filter((pose) => pose.startsWith("recover-")),
    ),
  ]);

  for (const poseName of articulatedPoses) {
    const patches = ASCII_POSES[poseName];
    const frame = applyAsciiPose(art, poseName);
    const frameLines = frame.split("\n");
    const handPatch = patches.find(
      ({ text }) => text.includes("@") && text.includes(">"),
    );
    const elbowPatch = patches.find(({ text }) => text.includes("(OOO)"));

    if (!handPatch || !elbowPatch || handPatch.row >= ASCII_ANATOMY.head.top) {
      throw new Error(`ASCII pose ${poseName} must keep its hand above the head.`);
    }

    const handColumn = handPatch.column + handPatch.text.indexOf("@");
    const elbowColumn =
      elbowPatch.column + elbowPatch.text.indexOf("OOO") + 1;
    const armSegments = patches
      .filter(({ text }) => text.includes("OOO"))
      .map(({ row, column, text }) => ({
        row,
        column: column + text.indexOf("OOO") + 1,
      }))
      .sort((a, b) => a.row - b.row);
    const armRows = new Set(armSegments.map(({ row }) => row));

    if (
      ASCII_ANATOMY.shoulder.row >= ASCII_ANATOMY.lowerTorso.top ||
      ASCII_ANATOMY.shoulder.column < ASCII_ANATOMY.head.right - 1 ||
      armSegments.some(({ row }) => row >= ASCII_ANATOMY.lowerTorso.top)
    ) {
      throw new Error(
        `ASCII pose ${poseName} must root at the outer shoulder and stay clear of the lower torso.`,
      );
    }

    for (let row = handPatch.row + 1; row <= ASCII_ANATOMY.shoulder.row; row += 1) {
      if (!armRows.has(row)) {
        throw new Error(`ASCII pose ${poseName} disconnects the arm at row ${row}.`);
      }
    }

    for (let index = 1; index < armSegments.length; index += 1) {
      const previous = armSegments[index - 1];
      const current = armSegments[index];
      if (
        current.row - previous.row > 1 ||
        Math.abs(current.column - previous.column) > 5
      ) {
        throw new Error(`ASCII pose ${poseName} breaks the arm's lateral path.`);
      }
    }

    const firstArmSegment = armSegments[0];
    const lastArmSegment = armSegments[armSegments.length - 1];
    const rowAspect = 2.25;
    const handVector = [
      handColumn - elbowColumn,
      (handPatch.row - elbowPatch.row) * rowAspect,
    ];
    const shoulderVector = [
      ASCII_ANATOMY.shoulder.column - elbowColumn,
      (ASCII_ANATOMY.shoulder.row - elbowPatch.row) * rowAspect,
    ];
    const cosine =
      (handVector[0] * shoulderVector[0] +
        handVector[1] * shoulderVector[1]) /
      (Math.hypot(...handVector) * Math.hypot(...shoulderVector));
    const elbowAngle =
      (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;

    if (
      Math.abs(firstArmSegment.column - handColumn) > 5 ||
      Math.abs(
        lastArmSegment.column - ASCII_ANATOMY.shoulder.column,
      ) > 5
    ) {
      throw new Error(`ASCII pose ${poseName} floats away from a joint.`);
    }
    if (elbowAngle < 98 || elbowAngle > 155) {
      throw new Error(`ASCII pose ${poseName} lost its slight elbow bend.`);
    }

    const penLength =
      handPatch.text.indexOf(">") - handPatch.text.indexOf("@");
    if (
      penLength < 5 ||
      penLength > 7 ||
      frame.includes("-----") ||
      frame.includes("lxl._")
    ) {
      throw new Error(`ASCII pose ${poseName} regressed to a rod-like gesture.`);
    }
    if (
      frameLines[ASCII_ANATOMY.shoulder.row][
        ASCII_ANATOMY.shoulder.column
      ] !== "/"
    ) {
      throw new Error(`ASCII pose ${poseName} detached from the shoulder.`);
    }
  }

  for (const direction of directions) {
    const gazeMarker = direction.endsWith("left") ? "<" : ">";
    const directionalPoses = [
      ...ASCII_SEQUENCES.swat[direction],
      ...ASCII_SEQUENCES.recover[direction].filter(({ pose }) =>
        pose.startsWith("recover-"),
      ),
    ];

    for (const { pose } of directionalPoses) {
      const frameLines = applyAsciiPose(art, pose).split("\n");
      const face = frameLines[27].slice(
        ASCII_ANATOMY.head.left,
        ASCII_ANATOMY.head.right + 1,
      );
      const brow = frameLines[26].slice(
        ASCII_ANATOMY.head.left,
        ASCII_ANATOMY.head.right + 1,
      );
      if (
        !face.includes(gazeMarker) ||
        (direction.startsWith("upper-") && !brow.includes("^"))
      ) {
        throw new Error(`ASCII pose ${pose} looks away from ${direction}.`);
      }
    }
  }

  for (const [regionName, region] of Object.entries(ASCII_REGIONS)) {
    if (
      region.top < 0 ||
      region.left < 0 ||
      region.bottom >= ASCII_ROWS ||
      region.right >= ASCII_COLUMNS ||
      region.top > region.bottom ||
      region.left > region.right
    ) {
      throw new Error(`ASCII region ${regionName} exceeds the portrait grid.`);
    }
  }

  for (const [direction, anatomy] of Object.entries(ASCII_ANATOMY.contact)) {
    const contactFrame = applyAsciiPose(art, anatomy.pose).split("\n");
    const gazePatches = ASCII_POSES[anatomy.gazePose].filter(
      ({ row, column, text }) =>
        row >= ASCII_ANATOMY.head.top &&
        row <= ASCII_ANATOMY.head.bottom &&
        column <= ASCII_ANATOMY.head.right &&
        column + text.length - 1 >= ASCII_ANATOMY.head.left,
    );
    const headRows = new Set(gazePatches.map(({ row }) => row));
    const gazeMarker = direction.endsWith("left") ? "<" : ">";
    const changedHeadRows = new Set();
    for (
      let row = ASCII_ANATOMY.head.top;
      row <= ASCII_ANATOMY.head.bottom;
      row += 1
    ) {
      const baseHead = baseLines[row].slice(
        ASCII_ANATOMY.head.left,
        ASCII_ANATOMY.head.right + 1,
      );
      const contactHead = contactFrame[row].slice(
        ASCII_ANATOMY.head.left,
        ASCII_ANATOMY.head.right + 1,
      );
      if (baseHead !== contactHead) changedHeadRows.add(row);
    }
    const elbowToHand = {
      row: anatomy.hand.row - anatomy.elbow.row,
      column: anatomy.hand.column - anatomy.elbow.column,
    };
    const elbowToShoulder = {
      row: ASCII_ANATOMY.shoulder.row - anatomy.elbow.row,
      column: ASCII_ANATOMY.shoulder.column - anatomy.elbow.column,
    };
    const bend = Math.abs(
      elbowToHand.column * elbowToShoulder.row -
        elbowToHand.row * elbowToShoulder.column,
    );

    if (anatomy.hand.row >= ASCII_ANATOMY.head.top) {
      throw new Error(`ASCII ${direction} hand must rise above the head.`);
    }
    if (anatomy.elbow.row >= ASCII_ANATOMY.shoulder.row || bend < 24) {
      throw new Error(`ASCII ${direction} arm must retain a visible elbow bend.`);
    }
    if (
      anatomy.penTip.row !== anatomy.hand.row ||
      anatomy.penTip.column <= anatomy.hand.column + 4 ||
      anatomy.penTip.column - anatomy.hand.column > 7
    ) {
      throw new Error(`ASCII ${direction} pen must point behind the raised hand.`);
    }
    if (
      contactFrame[anatomy.hand.row][anatomy.hand.column] !== "@" ||
      contactFrame[anatomy.elbow.row][anatomy.elbow.column] !== "O" ||
      contactFrame[anatomy.penTip.row][anatomy.penTip.column] !== ">" ||
      contactFrame[ASCII_ANATOMY.shoulder.row][ASCII_ANATOMY.shoulder.column] !==
        "/"
    ) {
      throw new Error(`ASCII ${direction} contact pose lost an anatomy landmark.`);
    }
    if (
      headRows.size < 3 ||
      changedHeadRows.size < 3 ||
      !contactFrame[27]
        .slice(ASCII_ANATOMY.head.left, ASCII_ANATOMY.head.right + 1)
        .includes(gazeMarker)
    ) {
      throw new Error(`ASCII ${direction} gaze must tilt the full head.`);
    }
  }

  if (baseLines.some((line) => line.length !== ASCII_COLUMNS)) {
    throw new Error("ASCII base portrait is not normalized to fixed-width rows.");
  }

  return true;
}

validateAsciiCharacterDefinition();
