function Paper(title, language, publisher, date, authors, collections) {
  this.title = title;
  this.language = language;
  this.publisher = publisher;
  this.date = new Date(date);
  this.authors = authors;
  this.collections = collections;
}

var papers = [
  new Paper(
    "Ethical Machines",
    ["English"],
    ["Harvard Business Review Press"],
    "2022-09-20",
    ["Reid Blackman"],
    ["Business", "Technology"],
  ),
  new Paper(
    "Getting to Maybe: How to Excel on Law School Exams",
    ["English"],
    ["Carolina Academic Press"],
    "1999-05-26",
    ["Richard Fischl", "Jeremy Paul"],
    ["Business"],
  ),
  new Paper(
    "Modern Grantmaking: A Guide for Funders who Believe Better Is Possible",
    ["English"],
    ["Modern Grantmaking"],
    "2022-05-22",
    ["Gemma Bull", "Tom Steinberg"],
    ["Business"]
  ),
  new Paper(
    "Brief: Make a Bigger Impact by Saying Less",
    ["English"],
    ["Wiley"],
    "2014-02-10",
    ["Joseph McCormack"],
    ["Lifestyle", "Business"]
  ),
  new Paper(
    "Managing Data for Patron Privacy: Comprehensive Strategies for Libraries",
    ["English"],
    ["ALA Editions"],
    "2022-08-08",
    ["Kristin Briney", "Becky Yoose"],
    ["Civil"]
  ),
  new Paper(
    "Anonymity",
    ["English"],
    ["ALA Neal-Schuman"],
    "2019-05-21",
    ["Alison Macrina", "Talya Cooper"],
    ["Civil"]
  ),
  new Paper(
    "A Short Hike",
    ["English", "Spanish - Latin America", "French", "Japanese", "Portuguese - Brazil"],
    ["Whippoorwill"],
    "2019-04-05",
    ["Adam Robinson-Yu", "Adamgryu"],
    ["Entertainment"]
  ),
  new Paper(
    "Grit: The Power of Passion and Perseverance",
    ["English"],
    ["Simon & Schuster"],
    "2016-05-03",
    ["Angela Duckworth"],
    ["Lifestyle"]
  ),
  new Paper(
    "The Life-Changing Magic of Tidying Up: the Japanese Art of Decluttering and Organizing",
    ["English"],
    ["Clarkson Potter/Ten Speed"],
    "2014-10-14",
    ["Marie Kondo"],
    ["Lifestyle"]
  ),
  new Paper(
    "Spark Joy: An Illustrated Master Class on the Art of Organizing and Tidying Up",
    ["English"],
    ["Clarkson Potter", "Ten Speed Press"],
    "2016-01-05",
    ["Marie Kondo"],
    ["Lifestyle"]
  ),
  new Paper(
    "The Food of Sichuan",
    ["English"],
    ["Norton, W. W. & Company, Inc."],
    "2019-10-15",
    ["Fuschia Dunlop"],
    ["Lifestyle"]
  ),
  new Paper(
    "Never Eat Alone, Expanded and Updated: And Other Secrets to Success, One Relationship at a Time",
    ["English"],
    ["Crown Publishing Group"],
    "2014-06-03",
    ["Keith Ferrazzi", "Tahl Raz"],
    ["Lifestyle"]
  ),
  new Paper(
    "Fall of Porcupine",
    ["English", "German", "French", "Japanese", "Korean", "Chinese - Simplified"],
    ["Assemble Entertainment"],
    "2023-06-15",
    ["Critical Rabbit"],
    ["Entertainment"]
  ),
  new Paper(
    "Poor Charlie's Almanack: The Essential Wit and Wisdom of Charles T. Munger",
    ["English"],
    ["Stripe Matter, Inc."],
    "2023-12-05",
    ["Charles T. Munger"],
    ["Lifestyle"]
  ),
  new Paper(
    "The Ivy Portfolio: How to Invest Like the Top Endowments and Avoid Bear Markets",
    ["English"],
    ["Wiley"],
    "2011-04-05",
    ["Mebane T. Faber", "Eric W. Richardson"],
    ["Lifestyle"]
  ),
  new Paper(
    "The Wind Rises",
    ["Japanese", "English"],
    ["Studio Ghibli"],
    "2013-7-20",
    ["Hayao Miyazaki", "Toshio Suzuki"],
    ["Entertainment"]
  ),
  new Paper(
    "Meditations",
    ["English"],
    ["N/A"],
    "Incomplete Information: 180",
    ["Marcus Aurelius"],
    ["Lifestyle"]
  ),
  new Paper(
    "Mastery",
    ["English"],
    ["Penguin Books"],
    "2013-10-29",
    ["Robert Greene"],
    ["Lifestyle"]
  ),
  new Paper(
    "On Liberty",
    ["English"],
    ["John W. Parker and Son"],
    "Incomplete Information: 1859",
    ["John Stuart Mill"],
    ["Civil"]
  ),
  new Paper(
    "Individualism and the Economic Order",
    ["English"],
    ["Friedrich Hayek"],
    "Incomplete Information: April 1947",
    ["Routledge Press"],
    ["Civil"]
  ),
  new Paper(
    "Self-Reliance",
    ["English"],
    ["Ralph Emerson"],
    "Incomplete Information: 1841",
    ["James Munroe and Company"],
    ["Lifestyle"]
  ),
];
