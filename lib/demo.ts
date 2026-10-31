import type {
  Component,
  Difficulty,
  LearningNode,
  TutorAnswer,
  VisualStyle,
} from "./types";

export class DemoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DemoError";
  }
}

/* Curated educational examples. The scientific engine example uses a real
 * seeded Ideogram result with manually inspected labels. Other examples and
 * engine style palettes use original vector schematics. Demo text is predefined. */
type Part = [
  id: string,
  name: string,
  description: string,
  fn: string,
  question: string,
  details: string,
  x: number,
  y: number,
];
type Topic = {
  title: string;
  category: string;
  summary: string;
  explanation: string;
  parts: Part[];
  followUps: string[];
  caveat?: string;
};
const topics: Record<string, Topic> = {
  engine: {
    title: "Inside a combustion engine",
    category: "Engineering",
    summary: "A precisely timed chain reaction turns fuel into motion.",
    explanation:
      "An engine converts chemical energy in fuel into mechanical work. In a four-stroke gasoline engine, the piston first draws in air and fuel, then compresses the mixture. A spark starts combustion. The expanding hot gases push the piston down, and a connecting rod turns that movement into rotation at the crankshaft. Finally, an exhaust valve opens to let the spent gases leave. The cycle takes two crankshaft revolutions.",
    parts: [
      [
        "piston",
        "Piston",
        "A close-fitting metal crown that slides inside the cylinder.",
        "Receives force from expanding combustion gases and passes it to the connecting rod.",
        "How does a piston work?",
        "The piston moves between top dead center and bottom dead center. Its rings help seal the gap to the cylinder wall. Only the power stroke produces useful work directly; the crankshaft and other cylinders keep the remaining strokes moving.",
        0.5,
        0.5,
      ],
      [
        "spark",
        "Spark plug",
        "An insulated electrical device at the top of the combustion chamber.",
        "Starts combustion with a brief spark across a small electrode gap.",
        "How does a spark plug ignite fuel?",
        "A high-voltage pulse jumps the electrode gap. The spark initiates a flame front that spreads through the compressed air–fuel mixture; the whole mixture does not burn instantaneously. Timing is adjusted with speed and load.",
        0.5,
        0.22,
      ],
      [
        "intake",
        "Intake valve",
        "The blue valve and passage on the left side of the head.",
        "Opens to admit fresh air and fuel to the cylinder.",
        "What happens during the four strokes?",
        "A camshaft controls valve lift and timing. In this simplified spark-ignition example, the intake valve opens during the intake stroke. Real engines may use direct injection and overlap their valve opening periods.",
        0.379,
        0.306,
      ],
      [
        "exhaust",
        "Exhaust valve",
        "The violet valve and passage on the right side of the head.",
        "Lets hot exhaust gases leave after the power stroke.",
        "What happens during the exhaust stroke?",
        "The exhaust valve opens near the end of the power stroke and remains open as the piston rises to push gases out. It withstands much higher temperatures than the intake valve.",
        0.632,
        0.306,
      ],
      [
        "crankshaft",
        "Crankshaft",
        "The offset rotating assembly beneath the cylinder.",
        "Converts the connecting rod’s back-and-forth movement into rotation.",
        "How does a crankshaft turn piston motion into rotation?",
        "The rod pushes on a crankpin offset from the shaft axis. That offset creates torque. Bearings support the shaft, while counterweights help manage unbalanced forces. A flywheel smooths speed changes between power strokes.",
        0.5,
        0.76,
      ],
      [
        "rod",
        "Connecting rod",
        "The narrow link between the piston and crankshaft.",
        "Transfers the piston’s force to an offset crankpin while pivoting at both ends.",
        "How does a crankshaft turn piston motion into rotation?",
        "The rod’s small end connects to the piston through a wrist pin; its big end turns around the crankpin. The changing rod angle creates a side load on the piston and cylinder. The rod experiences alternating gas and inertia loads.",
        0.5,
        0.65,
      ],
      [
        "cylinder",
        "Cylinder",
        "The machined bore surrounding the piston.",
        "Guides the piston and contains the pressure of combustion.",
        "How do piston rings seal the cylinder?",
        "A thin oil film separates most sliding surfaces. The cylinder wall transfers heat to the engine block and cooling system. The bore, piston clearance, ring seal, and lubrication all matter to efficiency and durability.",
        0.655,
        0.49,
      ],
    ],
    followUps: [
      "What happens when the piston moves down?",
      "How do piston rings work?",
      "Show me the four-stroke cycle",
    ],
    caveat:
      "A simplified single-cylinder, spark-ignition schematic. Valve timing, fuel injection, and cylinder arrangement vary between engines.",
  },
  piston: {
    title: "The piston: pressure into motion",
    category: "Engineering",
    summary: "A small moving part handles enormous heat and pressure.",
    explanation:
      "The piston is a sliding seal and a force transmitter. Gas pressure acts on its crown. Compression rings reduce gas leakage, an oil-control ring manages the oil film, and the skirt guides the piston in the cylinder. A wrist pin allows the connecting rod to pivot as the crankshaft rotates. During intake the piston moves down and helps draw in charge; during the power stroke it moves down because expanding gases push it.",
    parts: [
      [
        "crown",
        "Piston crown",
        "The strong upper surface facing combustion.",
        "Receives gas pressure and transfers heat into the piston body.",
        "What happens during the four-stroke cycle?",
        "The crown’s shape affects combustion chamber geometry. Heat leaves mainly through the rings and cylinder wall, and through the skirt and oil. Some high-output engines spray oil onto the underside for cooling.",
        0.5,
        0.26,
      ],
      [
        "rings",
        "Piston rings",
        "Thin split metal rings seated in grooves near the crown.",
        "Seal combustion gases, control lubricating oil, and conduct heat.",
        "How do piston rings seal the cylinder?",
        "Typically, two compression rings limit blow-by and one oil-control assembly meters the oil film. Ring tension and gas pressure help press the rings against the cylinder wall.",
        0.5,
        0.35,
      ],
      [
        "pin",
        "Wrist pin",
        "The transverse pin through the piston and rod’s small end.",
        "Allows the connecting rod to pivot while transmitting force.",
        "How does a crankshaft turn piston motion into rotation?",
        "The wrist pin carries alternating loads. Depending on the engine, it can rotate in the piston bosses and rod, or be fixed in one of them. Lubrication reduces friction at the bearing surfaces.",
        0.5,
        0.5,
      ],
      [
        "skirt",
        "Piston skirt",
        "The longer lower sides of the piston.",
        "Keeps the piston aligned and spreads side force against the bore.",
        "Why do pistons need an oil film?",
        "As the connecting rod angles away from vertical, it creates a sideways force. The skirt distributes that load. Carefully designed clearance permits thermal expansion without excessive slap.",
        0.636,
        0.48,
      ],
      [
        "rod",
        "Connecting rod",
        "The link between the wrist pin and crankpin.",
        "Transfers force while changing angle throughout each revolution.",
        "How does a crankshaft turn piston motion into rotation?",
        "The rod experiences compression and tension as gas and inertia forces change. Its big end turns around the crankpin, while its small end pivots on the wrist pin.",
        0.5,
        0.71,
      ],
    ],
    followUps: [
      "What happens when the piston moves down?",
      "How do piston rings work?",
      "Why do pistons need an oil film?",
    ],
  },
  rings: {
    title: "The tiny rings that seal the cylinder",
    category: "Engineering",
    summary: "Three narrow bands manage pressure, heat, and oil.",
    explanation:
      "Piston rings are split metal bands fitted into grooves. Compression rings reduce the passage of hot combustion gases into the crankcase, a leakage called blow-by. They also conduct heat from the piston to the cylinder wall. The oil-control ring scrapes excess oil off the wall while leaving a thin film for lubrication. The rings have small end gaps to accommodate installation and thermal expansion.",
    parts: [
      [
        "compression",
        "Compression rings",
        "The upper two bright bands around the piston.",
        "Limit combustion-gas leakage and transfer heat to the cylinder wall.",
        "How does compression help an engine?",
        "Ring tension supplies an initial seal; combustion pressure behind and above the ring can improve its contact. No practical ring pack seals perfectly. Excessive wear increases blow-by and can lower compression.",
        0.5,
        0.33,
      ],
      [
        "oil",
        "Oil-control ring",
        "The lower ring assembly with drainage openings.",
        "Meters the wall’s oil film and drains excess oil back inward.",
        "Why do pistons need an oil film?",
        "Oil-control assemblies often use two thin rails and an expander, although designs vary. Too little oil increases friction and wear; too much can enter the combustion chamber and burn.",
        0.5,
        0.46,
      ],
      [
        "gap",
        "Ring end gap",
        "The small opening in each split ring.",
        "Leaves room for the ring to expand as it heats.",
        "Why do piston rings have a gap?",
        "The ring must compress during installation and expand at operating temperature. If the ends touch when hot, the ring can exert excessive force on the bore and cause damage.",
        0.648,
        0.34,
      ],
    ],
    followUps: [
      "Why do piston rings have a gap?",
      "What is blow-by?",
      "Why do pistons need an oil film?",
    ],
  },
  cycle: {
    title: "Four strokes. One repeating cycle.",
    category: "Engineering",
    summary: "Intake, compression, power, exhaust—then start again.",
    explanation:
      "A stroke is one trip of the piston between its upper and lower limits. Intake: the descending piston draws fresh charge through the open intake valve. Compression: with valves closed, the piston rises and compresses the mixture. Power: ignition near the end of compression starts combustion; expanding gas drives the piston down. Exhaust: the piston rises with the exhaust valve open. A complete cycle requires two crankshaft revolutions.",
    parts: [
      [
        "intake",
        "Intake",
        "The first chamber, with a blue incoming flow.",
        "Fills the cylinder as the piston descends.",
        "What happens when the piston moves down?",
        "The open intake valve connects the cylinder to the intake system. Piston movement lowers cylinder pressure relative to the intake, so gas flows in. Turbocharging can raise intake pressure.",
        0.18,
        0.5,
      ],
      [
        "compression",
        "Compression",
        "The second chamber, with the piston near the top.",
        "Raises the mixture’s pressure and temperature before ignition.",
        "How does compression help an engine?",
        "Compression prepares the charge for combustion and enables an expansion process that produces work. Higher compression ratios can improve thermal efficiency, but gasoline engines are limited by knock and other constraints.",
        0.395,
        0.39,
      ],
      [
        "power",
        "Power",
        "The third chamber, with a warm combustion glow.",
        "Uses hot expanding gas to do work on the piston.",
        "How does a spark plug ignite fuel?",
        "Combustion raises gas temperature and pressure. The gas then expands as the piston descends. Only a portion of fuel energy becomes shaft work; much leaves as heat in exhaust and cooling.",
        0.61,
        0.5,
      ],
      [
        "exhaust",
        "Exhaust",
        "The fourth chamber, with a violet outgoing flow.",
        "Pushes spent gases out as the piston rises.",
        "What happens during the exhaust stroke?",
        "Opening the exhaust valve first releases some pressure, then the rising piston displaces gas into the exhaust system. Some residual gas remains in the cylinder.",
        0.825,
        0.39,
      ],
    ],
    followUps: [
      "What happens when the piston moves down?",
      "How does compression help an engine?",
      "Where does the engine’s energy go?",
    ],
  },
  spark: {
    title: "A tiny spark starts the power stroke",
    category: "Engineering",
    summary: "Precisely timed ignition releases the energy in fuel.",
    explanation:
      "A spark plug contains a central conductor insulated from its metal shell by ceramic. The ignition coil supplies a high voltage, making a short electrical discharge jump the gap to the ground electrode. The discharge ignites a small region of the air–fuel mixture. A flame front then spreads through the chamber. The spark initiates combustion; the fuel supplies the energy.",
    parts: [
      [
        "terminal",
        "Terminal",
        "The electrical connection at the top.",
        "Receives a high-voltage pulse from the ignition system.",
        "How does a spark plug ignite fuel?",
        "The ignition coil stores energy in a magnetic field and releases it as a high-voltage pulse. The exact voltage needed depends on pressure, mixture, electrode gap, and conditions.",
        0.5,
        0.18,
      ],
      [
        "ceramic",
        "Ceramic insulator",
        "The ribbed insulating body.",
        "Keeps high voltage away from the grounded metal shell.",
        "Why is a spark plug insulated?",
        "The ceramic withstands heat and electrically separates the center conductor from the shell. Its ribs increase the surface path length and help resist external flashover.",
        0.5,
        0.37,
      ],
      [
        "electrode",
        "Electrode gap",
        "The small bright gap at the firing end.",
        "Provides the location where the spark starts a flame.",
        "What happens during the four-stroke cycle?",
        "A spark is normally commanded before top dead center because combustion takes time. Excessively early combustion or abnormal knock can damage an engine.",
        0.5,
        0.78,
      ],
    ],
    followUps: [
      "How does ignition timing work?",
      "Show me the four-stroke cycle",
      "Where does the energy come from?",
    ],
  },
  crankshaft: {
    title: "Turning an up-and-down push into rotation",
    category: "Engineering",
    summary: "An offset crankpin gives the connecting rod a lever.",
    explanation:
      "A crankshaft has main journals that rotate around a common axis and crankpins offset from that axis. The connecting rod’s big end turns around a crankpin. As the piston pushes, the offset creates a turning moment called torque. The leverage changes with crank angle. Counterweights manage inertia forces, and bearings support the shaft on an oil film.",
    parts: [
      [
        "crankpin",
        "Crankpin",
        "The offset journal carrying the connecting rod.",
        "Provides the lever arm that converts force into torque.",
        "How does a crankshaft turn piston motion into rotation?",
        "Torque depends on the force and its perpendicular distance from the rotation axis. Near dead center the instantaneous leverage is small, even if cylinder pressure is high.",
        0.55,
        0.45,
      ],
      [
        "bearing",
        "Main bearing",
        "The support aligned with the crankshaft axis.",
        "Supports the rotating shaft and transmits loads into the block.",
        "Why do engines need an oil film?",
        "Pressurized oil feeds the bearing clearance. Relative motion forms a load-carrying hydrodynamic film under suitable conditions, separating the bearing and journal surfaces.",
        0.3,
        0.64,
      ],
      [
        "counterweight",
        "Counterweight",
        "The broad curved mass opposite the crankpin.",
        "Balances rotating mass and part of the reciprocating inertia.",
        "Why does a crankshaft need counterweights?",
        "Counterweights reduce bearing loads and unbalanced forces. A complete balance strategy depends on cylinder count, firing order, crank geometry, and sometimes balance shafts.",
        0.6,
        0.72,
      ],
    ],
    followUps: [
      "Why does a crankshaft need counterweights?",
      "What is torque?",
      "Show me the four-stroke cycle",
    ],
  },
  heart: {
    title: "Your heart is a double pump",
    category: "Biology",
    summary: "Two connected circuits keep oxygen moving through your body.",
    explanation:
      "The right side of the heart receives oxygen-poor blood from the body and pumps it to the lungs. Oxygen-rich blood returns to the left side, which pumps it through the aorta to the body. The atria receive blood and the ventricles pump it out. One-way valves reduce backward flow. Electrical signals coordinate filling and contraction.",
    parts: [
      [
        "right-atrium",
        "Right atrium",
        "The upper blue chamber on the viewer’s left.",
        "Receives oxygen-poor blood returning from the body.",
        "How does blood flow through the human heart?",
        "The superior and inferior venae cavae bring blood to the right atrium. It flows through the tricuspid valve into the right ventricle.",
        0.365,
        0.4,
      ],
      [
        "right-ventricle",
        "Right ventricle",
        "The lower blue chamber on the viewer’s left.",
        "Pumps blood through the pulmonary valve toward the lungs.",
        "How does blood flow through the human heart?",
        "The pulmonary circuit operates at lower pressure than the systemic circuit. The right ventricular wall is therefore generally thinner than the left.",
        0.39,
        0.62,
      ],
      [
        "left-atrium",
        "Left atrium",
        "The upper pink chamber on the viewer’s right.",
        "Receives oxygen-rich blood from the lungs.",
        "How does blood flow through the human heart?",
        "Pulmonary veins return blood to the left atrium, then through the mitral valve into the left ventricle. Veins are defined by direction toward the heart, not oxygen content.",
        0.625,
        0.4,
      ],
      [
        "left-ventricle",
        "Left ventricle",
        "The thick-walled lower pink chamber.",
        "Pumps blood through the aortic valve to the body.",
        "Why is the left ventricle thicker?",
        "Its muscular wall generates the pressure needed to drive blood through the systemic circulation. The septum separates the ventricular chambers.",
        0.61,
        0.63,
      ],
      [
        "aorta",
        "Aorta",
        "The large arch leaving the top of the heart.",
        "Carries oxygen-rich blood from the left ventricle to the body.",
        "How does blood flow through the human heart?",
        "The aorta’s elastic walls stretch during ejection and recoil between beats, helping smooth the flow. Its first branches supply the heart muscle itself.",
        0.555,
        0.22,
      ],
    ],
    followUps: [
      "Trace one drop of blood through the heart",
      "Why is the left ventricle thicker?",
      "What keeps blood flowing one way?",
    ],
    caveat:
      "A simplified frontal schematic; blue and pink indicate relative oxygen content, not the actual color of blood. Educational material, not medical advice.",
  },
  neural: {
    title: "How a neural network learns patterns",
    category: "Computer science",
    summary: "Many small calculations work together to make a prediction.",
    explanation:
      "A feed-forward neural network transforms inputs through layers of artificial neurons. Each connection has a weight. A neuron combines weighted inputs and a bias, then applies an activation function. During supervised training, a loss function compares a prediction with a target. Backpropagation computes gradients, and an optimizer updates parameters to reduce the loss over training examples.",
    parts: [
      [
        "input",
        "Input layer",
        "The four cyan nodes on the left.",
        "Receives the numerical features describing an example.",
        "How does information move through a neural network?",
        "Images, words, or measurements must be represented as numbers. Input preprocessing and representation affect what patterns a model can learn.",
        0.21,
        0.405,
      ],
      [
        "hidden",
        "Hidden layers",
        "The intermediate blue and violet columns.",
        "Combine features into progressively transformed representations.",
        "How does a neural network learn?",
        "An affine transformation followed by a nonlinear activation lets a network model more complex functions than a chain of linear operations alone.",
        0.3875,
        0.5,
      ],
      [
        "weight",
        "Learned connections",
        "The thin lines linking adjacent layers.",
        "Scale each signal by a trainable weight.",
        "How does a neural network learn?",
        "Weights are parameters learned from data, not individual stored rules. Backpropagation efficiently computes how a small change in a parameter would affect the loss.",
        0.35,
        0.44,
      ],
      [
        "output",
        "Output layer",
        "The two glowing nodes on the right.",
        "Produces scores or values used to form the prediction.",
        "How does a neural network make a prediction?",
        "An output can be a regression value, a class score, or part of a larger representation. Scores are not automatically well-calibrated probabilities.",
        0.79,
        0.43,
      ],
    ],
    followUps: [
      "What does a weight do?",
      "How does backpropagation work?",
      "What is an activation function?",
    ],
    caveat:
      "A small feed-forward network. Modern architectures can use attention, convolution, recurrence, and other structures. Artificial neurons are mathematical functions, not biological neurons.",
  },
  internet: {
    title: "A web page’s journey across the internet",
    category: "Computer science",
    summary: "Data travels in packets through a network of networks.",
    explanation:
      "When you open a website, your device usually uses DNS to find a server address, then establishes a secure connection. Your request travels through your local network, an internet provider, and intermediate networks to a server. Data is split into packets. Routers forward packets toward their destination. The response comes back and your browser combines the resources into the page you see.",
    parts: [
      [
        "device",
        "Your device",
        "The laptop at the left.",
        "Runs the browser and sends requests for web resources.",
        "How does the internet send a web page?",
        "The browser resolves names, manages connections, requests resources, and renders HTML and related content. Cached data may reduce the number of network requests.",
        0.17,
        0.52,
      ],
      [
        "router",
        "Local router",
        "The small access point beside the device.",
        "Connects your local network to an upstream provider.",
        "What does a router do?",
        "Routers choose where to forward an IP packet using routing information. Your home device may also provide Wi-Fi, firewalling, DHCP, and address translation.",
        0.36,
        0.52,
      ],
      [
        "network",
        "Internet routers",
        "The connected mesh at the center.",
        "Forward packets between independently operated networks.",
        "What does a router do?",
        "Packets do not require a dedicated end-to-end wire. Paths may change with routing policy or failure. Different protocols address delivery, reliability, and security.",
        0.58,
        0.45,
      ],
      [
        "server",
        "Web server",
        "The stacked computer units on the right.",
        "Processes the request and sends the requested content.",
        "How does the internet send a web page?",
        "A request may be answered by a content delivery network close to you rather than the site’s origin server. Many pages require multiple requests to multiple services.",
        0.83,
        0.49,
      ],
    ],
    followUps: [
      "What does a router do?",
      "What is a packet?",
      "How does DNS find a website?",
    ],
  },
  camera: {
    title: "From light to a photograph",
    category: "Physics",
    summary: "A lens, an opening, and a sensor capture a moment.",
    explanation:
      "Light from a scene passes through the lens, which forms an image on a sensor. The aperture controls the size of the opening and influences both light collection and depth of field. Exposure time controls how long light is collected. The sensor converts photons into an electrical signal, and image processing turns those measurements into a photograph. ISO generally controls signal amplification and output brightness, not the number of photons collected.",
    parts: [
      [
        "lens",
        "Lens elements",
        "The curved glass group on the left.",
        "Refract light to form a focused image at the sensor.",
        "How does a camera focus light?",
        "Several elements reduce optical aberrations. Focusing changes element positions or spacing so that a subject at a chosen distance forms a sharp image on the sensor plane.",
        0.24,
        0.51,
      ],
      [
        "aperture",
        "Aperture",
        "The narrow opening in the middle of the optical path.",
        "Controls light throughput and influences depth of field.",
        "How does a camera aperture work?",
        "The f-number is focal length divided by entrance-pupil diameter. A smaller f-number generally admits more light for the same scene and exposure time and gives shallower depth of field.",
        0.391,
        0.51,
      ],
      [
        "shutter",
        "Shutter",
        "The thin blades just before the sensor.",
        "Sets the exposure interval, mechanically or electronically.",
        "What does shutter speed change?",
        "Short exposures reduce motion blur but collect fewer photons at a given aperture. Electronic shutters can expose or read different rows at different times, causing rolling-shutter distortion.",
        0.66,
        0.51,
      ],
      [
        "sensor",
        "Image sensor",
        "The glowing rectangular plane on the right.",
        "Converts incoming light into measurable electrical charge.",
        "How does a camera sensor work?",
        "Photodiodes collect charge related to incoming photons. Most color cameras use a filter mosaic and reconstruct full-color pixels through demosaicing. Noise comes from several physical and electronic sources.",
        0.75,
        0.51,
      ],
    ],
    followUps: [
      "How does a camera aperture work?",
      "What does shutter speed change?",
      "How does a camera focus light?",
    ],
    caveat:
      "A simplified cross section; lens designs, shutter types, and sensor arrangements vary.",
  },
  nuclear: {
    title: "A nuclear power plant is a heat engine",
    category: "Energy",
    summary: "Controlled fission creates heat; steam turns a generator.",
    explanation:
      "In a pressurized-water reactor, fission in fuel rods heats a primary coolant loop kept under high pressure. A steam generator transfers heat to a separate secondary loop, producing steam. That steam drives a turbine connected to an electrical generator. A condenser cools the steam back into water for reuse. Control rods absorb neutrons to regulate the chain reaction.",
    parts: [
      [
        "reactor",
        "Reactor vessel",
        "The large shielded vessel on the left.",
        "Contains the fuel and primary coolant where fission heat is produced.",
        "How does a nuclear reactor produce heat?",
        "A neutron can split a fissile nucleus, releasing energy and more neutrons. Reactor design controls the population of neutrons so power can be kept steady.",
        0.23,
        0.53,
      ],
      [
        "control",
        "Control rods",
        "The long violet rods descending into the core.",
        "Absorb neutrons to help regulate or stop the chain reaction.",
        "What do control rods do?",
        "Control materials absorb neutrons. Reactor behavior also depends on fuel, coolant, temperature feedback, and other systems. Decay heat remains after shutdown and still needs removal.",
        0.23,
        0.37,
      ],
      [
        "steam",
        "Steam generator",
        "The central heat exchanger joining two separate loops.",
        "Transfers heat from primary coolant to secondary water.",
        "How does nuclear heat become electricity?",
        "In this pressurized-water example, primary coolant does not normally mix with secondary water. Other reactor types use different arrangements.",
        0.48,
        0.5,
      ],
      [
        "turbine",
        "Turbine and generator",
        "The bladed rotor and electrical machine on the right.",
        "Convert steam energy into rotation, then electrical energy.",
        "How does nuclear heat become electricity?",
        "Steam expands through turbine stages. The shaft drives a generator, where changing magnetic fields induce voltage. The thermodynamic cycle still requires a cold sink.",
        0.703,
        0.455,
      ],
      [
        "condenser",
        "Condenser",
        "The low blue heat exchanger beneath the turbine.",
        "Turns exhaust steam back into liquid water.",
        "Why does a power plant need cooling?",
        "Rejecting heat is necessary for the steam cycle. Condenser cooling can use a river, sea, cooling tower, or other heat sink; a cooling tower is not a reactor chimney.",
        0.75,
        0.7,
      ],
    ],
    followUps: [
      "What do control rods do?",
      "How does nuclear heat become electricity?",
      "Why does a power plant need cooling?",
    ],
    caveat:
      "A simplified pressurized-water reactor. This is a conceptual energy-flow diagram, not an engineering design.",
  },
};

const links: Record<string, [string, string, string][]> = {
  engine: [
    [
      "intake",
      "cylinder",
      "The intake valve admits fresh charge into the cylinder.",
    ],
    [
      "spark",
      "piston",
      "Ignition starts combustion; expanding gas pushes on the piston crown.",
    ],
    [
      "piston",
      "rod",
      "The wrist pin transfers piston force into the connecting rod.",
    ],
    [
      "rod",
      "crankshaft",
      "The connecting rod applies force to an offset crankpin.",
    ],
    [
      "cylinder",
      "exhaust",
      "The exhaust valve opens a path for spent gas to leave the cylinder.",
    ],
  ],
  piston: [
    [
      "crown",
      "rings",
      "The rings help transfer crown heat through the piston to the cylinder wall.",
    ],
    [
      "rings",
      "skirt",
      "The ring pack controls sealing and oil while the skirt guides the piston.",
    ],
    [
      "crown",
      "pin",
      "The piston body carries force from the crown to the wrist-pin bosses.",
    ],
    [
      "pin",
      "rod",
      "The wrist pin allows the connecting rod to pivot while transmitting load.",
    ],
  ],
  rings: [
    [
      "compression",
      "gap",
      "Compression rings have end gaps to permit installation and thermal expansion.",
    ],
    [
      "compression",
      "oil",
      "Compression rings primarily seal gas; the lower ring assembly primarily controls oil.",
    ],
  ],
  cycle: [
    [
      "intake",
      "compression",
      "After filling, the intake valve closes and the piston rises to compress the charge.",
    ],
    [
      "compression",
      "power",
      "Ignition near the end of compression starts the combustion event.",
    ],
    [
      "power",
      "exhaust",
      "After expansion, the exhaust valve opens and the next upstroke displaces spent gas.",
    ],
    ["exhaust", "intake", "Fresh charge enters as the next cycle begins."],
  ],
  spark: [
    [
      "terminal",
      "ceramic",
      "The ceramic insulates the central conductor from the grounded metal shell.",
    ],
    [
      "terminal",
      "electrode",
      "A high-voltage pulse reaches the center electrode and discharges across the gap.",
    ],
  ],
  crankshaft: [
    [
      "crankpin",
      "bearing",
      "The crankpin is offset from the main-bearing axis, creating the crank’s lever arm.",
    ],
    [
      "counterweight",
      "bearing",
      "Counterweights help reduce imbalance and loads carried by the main bearings.",
    ],
  ],
  heart: [
    [
      "right-atrium",
      "right-ventricle",
      "Blood passes through the tricuspid valve into the right ventricle.",
    ],
    [
      "right-ventricle",
      "left-atrium",
      "Blood travels through the lungs before returning to the left atrium.",
    ],
    [
      "left-atrium",
      "left-ventricle",
      "Blood passes through the mitral valve into the left ventricle.",
    ],
    [
      "left-ventricle",
      "aorta",
      "The contracting ventricle ejects blood through the aortic valve.",
    ],
  ],
  neural: [
    [
      "input",
      "hidden",
      "Numerical input features are transformed by the hidden layers.",
    ],
    [
      "weight",
      "hidden",
      "Weights scale the incoming signals used by each hidden neuron.",
    ],
    [
      "hidden",
      "output",
      "The final representation is transformed into output scores or values.",
    ],
  ],
  internet: [
    [
      "device",
      "router",
      "Your device sends packets through its local network.",
    ],
    [
      "router",
      "network",
      "The local router forwards packets toward the upstream provider.",
    ],
    [
      "network",
      "server",
      "Routers forward packets across networks to the destination server.",
    ],
  ],
  camera: [
    [
      "lens",
      "aperture",
      "The lens assembly and aperture determine the light rays admitted.",
    ],
    [
      "aperture",
      "shutter",
      "Light passes through the aperture during the exposure interval.",
    ],
    [
      "shutter",
      "sensor",
      "The exposure interval controls how long the sensor collects photons.",
    ],
  ],
  nuclear: [
    [
      "control",
      "reactor",
      "Control rods absorb neutrons within the reactor core.",
    ],
    [
      "reactor",
      "steam",
      "Hot primary coolant transfers heat to the steam generator.",
    ],
    [
      "steam",
      "turbine",
      "Secondary steam expands through the turbine to drive the generator.",
    ],
    [
      "turbine",
      "condenser",
      "Exhaust steam releases heat and condenses back to liquid.",
    ],
    [
      "condenser",
      "steam",
      "A pump returns the liquid water to the steam generator.",
    ],
  ],
};

const beginner: Record<string, string> = {
  engine:
    "Think of the engine as a carefully timed pump. It takes in air and fuel, squeezes them, lights them with a spark, and uses the expanding hot gas to push a piston. A rod and crank turn that push into a spinning motion. The engine then pushes out the used gas and repeats.",
  piston:
    "A piston is a metal part that slides up and down inside a cylinder. Hot gas pushes on its top. A rod underneath carries that push to the spinning crankshaft. Small rings around the piston help keep gas in and control oil.",
  rings:
    "Piston rings are thin metal bands around the piston. The top rings help keep hot gas above the piston. The lower ring clears away extra oil while leaving a slippery film. Each ring has a small gap so it has room to grow when hot.",
  cycle:
    "The piston makes four trips. Down: draw air and fuel in. Up: squeeze the mixture. Down again: hot burning gas pushes the piston and makes power. Up again: push the used gas out. Then the same sequence starts over.",
  spark:
    "The spark plug works like a tiny, carefully timed lightning bolt. Electricity jumps a small gap and starts burning the air and fuel. The spark starts the fire; the fuel provides the energy.",
  crankshaft:
    "A crankshaft works a little like a bicycle crank. A rod pushes on a point away from its center. That push turns the shaft. The shaft keeps turning while the piston moves up and down.",
  heart:
    "Your heart has two pumps working side by side. The right one sends blood to the lungs to pick up oxygen. The left one sends that blood around your body. Small doors called valves help keep the blood going the right way.",
  neural:
    "A neural network is a chain of small calculations. It takes in numbers, combines them in several layers, and produces a prediction. During practice, it compares predictions with examples and adjusts its connections to make fewer mistakes.",
  internet:
    "Your device sends a small request for a web page. Machines called routers pass the request across connected networks to a server. The server sends the page back in small pieces called packets. Your browser puts the information together.",
  camera:
    "A lens bends light to make a sharp image. The aperture is an opening that controls how much light can pass. The exposure time controls how long light is collected. A sensor turns the light into information that becomes your photo.",
  nuclear:
    "A nuclear plant uses heat to make electricity. Splitting atoms heats water in one loop. That heat makes steam in another loop. Steam spins a turbine connected to a generator. Cooling turns the steam back into water so the cycle can repeat.",
};

const seededEngineImage = "/demo/engine-ideogram.png";
const vectorCaveat =
  "Curated demo: educational text and original vector schematic, not an AI-generated result.";
const seededEngineCaveat =
  "Seeded demo illustration generated with Ideogram 4.5, with manually curated labels and predefined learning text. Its scientific depiction has not been independently verified; ambiguous valve positions are not labeled.";
const seededEngineHotspots = [
  { componentId: "piston", x: 0.5, y: 0.465, confidence: 0.98 },
  { componentId: "spark", x: 0.5, y: 0.16, confidence: 0.98 },
  { componentId: "crankshaft", x: 0.5, y: 0.82, confidence: 0.96 },
  { componentId: "rod", x: 0.5, y: 0.65, confidence: 0.98 },
  { componentId: "cylinder", x: 0.612, y: 0.6, confidence: 0.91 },
];

function demoVisual(key: string, style: VisualStyle) {
  const seeded = key === "engine" && style === "scientific";
  return {
    imageUrl: seeded
      ? seededEngineImage
      : `/demo/${key}${style === "scientific" ? "" : "-" + style}.svg`,
    hotspots: seeded
      ? seededEngineHotspots.map((h) => ({ ...h }))
      : topics[key].parts.map((p) => ({
          componentId: p[0],
          x: p[6],
          y: p[7],
          confidence: 1,
        })),
    caveat: seeded ? seededEngineCaveat : vectorCaveat,
  };
}

function chooseTopic(
  question: string,
  parent?: LearningNode,
  component?: Component,
): string {
  const q = `${question} ${component?.name || ""}`.toLowerCase();
  // A general engine overview may mention its four-stroke operating principle.
  // Keep that overview distinct from a request to inspect the cycle itself.
  if (/engine|combustion/.test(q) && /four.?stroke/.test(q)) return "engine";
  if (/ring|blow.?by|oil film|lubricat|end gap/.test(q)) return "rings";
  if (
    /four.?stroke|intake stroke|exhaust stroke|power stroke|compression|piston moves down|piston move down|energy go/.test(
      q,
    )
  )
    return "cycle";
  if (/spark|ignit/.test(q)) return "spark";
  if (/crank|connecting rod|wrist pin|counterweight|torque/.test(q))
    return "crankshaft";
  if (/piston|skirt/.test(q)) return "piston";
  if (/engine|combustion|cylinder/.test(q)) return "engine";
  if (/heart|ventricle|atrium|aorta|blood|cardiac/.test(q)) return "heart";
  if (
    /neural|backprop|neuron|weight|activation|network learn|network make|artificial intelligence/.test(
      q,
    )
  )
    return "neural";
  if (/internet|packet|router|dns|web page|website/.test(q)) return "internet";
  if (/camera|photograph|aperture|shutter|sensor|lens|focus light/.test(q))
    return "camera";
  if (/nuclear|reactor|fission|control rod|power plant|steam generator/.test(q))
    return "nuclear";
  if (
    parent &&
    /^where does (the )?energy come from[?.!]*\s*$/.test(q.trim()) &&
    parent.category === "Engineering"
  )
    return "engine";
  if (
    parent &&
    /^(explain (this|it)|explore deeper|tell me more|show me more|make it simpler|how does (it|this) work)[?.!]*\s*$/.test(
      q.trim(),
    )
  ) {
    const key = Object.keys(topics).find(
      (k) => topics[k].title === parent.title,
    );
    if (key) return key;
  }
  throw new DemoError(
    "The curated demo covers combustion engines, the human heart, neural networks, the internet, cameras, and nuclear power. Choose one of those topics, or connect a learning provider to explore your own question.",
  );
}

export function demoNode(
  question: string,
  difficulty: Difficulty,
  style: VisualStyle,
  parent?: LearningNode,
  component?: Component,
): LearningNode {
  if (parent && parent.depth >= 5)
    throw new DemoError(
      "You have reached this journey’s five-level limit. Go back to an earlier diagram or start a new topic.",
    );
  const key = chooseTopic(question, parent, component);
  const t = topics[key];
  const visual = demoVisual(key, style);
  const parts: Component[] = t.parts.map(
    ([id, name, description, fn, deeperQuestion, details]) => ({
      id,
      name,
      description,
      function: fn,
      visualDescription: description,
      deeperQuestion,
      details,
    }),
  );
  const levelText =
    difficulty === "beginner"
      ? beginner[key]
      : difficulty === "advanced"
        ? t.explanation +
          " The drawing isolates the main functional relationships; real systems include feedback, losses, and design-specific constraints."
        : t.explanation;
  return {
    id: `demo-${key}-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    parentId: parent?.id || null,
    depth: parent ? parent.depth + 1 : 0,
    question,
    title: t.title,
    summary: t.summary,
    category: t.category,
    difficulty,
    explanation: levelText,
    objectives: [
      `Identify the main parts of ${key === "engine" ? "a combustion engine" : t.title.toLowerCase()}.`,
      "Connect each part to its role in the whole system.",
      "Follow a component into a more detailed explanation.",
    ],
    components: parts,
    relationships: (links[key] || []).map(([from, to, description]) => ({
      from,
      to,
      description,
    })),
    followUps: t.followUps,
    caveats: [visual.caveat, ...(t.caveat ? [t.caveat] : [])],
    imageUrl: visual.imageUrl,
    hotspots: visual.hotspots,
    style,
    source: "demo",
    createdAt: new Date().toISOString(),
  };
}

export function demoRestyle(
  node: LearningNode,
  style: VisualStyle,
): LearningNode {
  const key = Object.keys(topics).find((k) => topics[k].title === node.title);
  if (!key)
    throw new DemoError("That diagram is not part of the curated demo.");
  const visual = demoVisual(key, style);
  const sameGeometry =
    (node.imageUrl === seededEngineImage) ===
    (visual.imageUrl === seededEngineImage);
  return {
    ...node,
    style,
    imageUrl: visual.imageUrl,
    hotspots: sameGeometry ? node.hotspots : visual.hotspots,
    caveats: [visual.caveat, ...node.caveats.slice(1)],
  };
}

const answers: Record<string, [RegExp, string][]> = {
  engineering: [
    [
      /piston.{0,20}(move|go).{0,15}down|down.{0,20}piston/i,
      "It depends on the stroke. On the intake stroke, the piston moves down with the intake valve open, drawing fresh charge into the cylinder. On the power stroke, it moves down because hot combustion gases push on its crown. In both cases, the connecting rod and crankshaft turn together with the piston’s motion.",
    ],
    [
      /blow.?by/i,
      "Blow-by is combustion gas that leaks past the piston rings into the crankcase. Some leakage is normal, but worn rings or a damaged cylinder can increase it. The crankcase ventilation system handles these gases.",
    ],
    [
      /ring.{0,20}gap|gap.{0,20}ring/i,
      "A piston ring is split so it can be installed and expand when hot. Its end gap must remain sufficient at operating temperature. If the ends touch as the ring heats up, the ring can load the cylinder wall excessively and cause damage.",
    ],
    [
      /oil film|lubricat|engine.{0,12}oil/i,
      "A thin film of oil reduces friction and wear between moving surfaces and helps carry heat away. Piston oil-control rings remove excess oil while leaving enough on the cylinder wall. Bearings also rely on an oil film to carry their loads.",
    ],
    [
      /compression/i,
      "Compression reduces the volume of the trapped air–fuel mixture before ignition, increasing its pressure and temperature. A suitable compression ratio helps an engine extract useful work during expansion. In gasoline engines, knock and material limits constrain how high that ratio can be.",
    ],
    [
      /energy|fuel.{0,12}power/i,
      "Fuel stores chemical energy. Combustion turns much of that energy into thermal energy in hot gas. The expanding gas does mechanical work on the piston. Some becomes useful shaft work; substantial energy also leaves through exhaust, cooling, and friction. The spark only starts combustion.",
    ],
    [
      /ignition timing|spark.{0,12}tim/i,
      "Combustion takes time, so a gasoline engine normally sparks before the piston reaches the top of its compression stroke. Timing aims to build pressure at a useful crank angle. The best timing depends on speed, load, mixture, and knock limits.",
    ],
    [
      /torque/i,
      "Torque is a turning effect: force multiplied by its perpendicular distance from the rotation axis. In an engine, a connecting rod pushes on an offset crankpin. The useful lever arm changes as the crank turns.",
    ],
    [
      /piston rings?|compression rings?|oil.control ring/i,
      topics.rings.explanation,
    ],
    [/four.?strokes?|four.?stroke cycle/i, topics.cycle.explanation],
    [/exhaust stroke/i, topics.cycle.parts[3][5]],
    [/crankshaft|connecting rod|wrist pin/i, topics.crankshaft.explanation],
    [/insulat|ceramic/i, topics.spark.parts[1][5]],
    [/spark|ignit/i, topics.spark.explanation],
  ],
  heart: [
    [
      /blood|drop|one way|valve|ventricle/i,
      "Follow one drop: body → right atrium → tricuspid valve → right ventricle → pulmonary valve → lungs → pulmonary veins → left atrium → mitral valve → left ventricle → aortic valve → body. Valves open and close as pressure differences change, helping keep blood flowing in one direction. The left ventricle has a thicker wall because it supplies the higher-pressure body circuit.",
    ],
  ],
  neural: [
    [
      /backprop/i,
      "Backpropagation applies the chain rule from calculus to work backward through a network and compute how each parameter affects the loss. An optimizer then uses those gradients to update the parameters. Repeating this over examples can improve predictions, but good training performance does not guarantee generalization.",
    ],
    [
      /weight|neural.{0,20}learn/i,
      "A weight is a learned multiplier on a connection. During training, the network makes a prediction, a loss measures the error, backpropagation computes gradients, and an optimizer adjusts weights and biases. Many small updates across examples can reveal useful patterns.",
    ],
    [
      /activation/i,
      "An activation function introduces a nonlinear step after a neuron combines its inputs. Without nonlinearities, stacking ordinary linear layers would still be equivalent to one linear transformation. A common activation is ReLU, which outputs zero for negative inputs and the input itself for positive ones.",
    ],
    [
      /information move|make a prediction|feed.?forward/i,
      topics.neural.explanation,
    ],
  ],
  internet: [
    [
      /dns/i,
      "DNS is the internet’s naming system. Your device asks a resolver for the IP address associated with a domain name. The resolver may answer from cache or query other DNS servers. The resulting address helps your device contact the appropriate service.",
    ],
    [
      /packet/i,
      "A packet is a bounded unit of data with addressing and control information. Routers forward IP packets hop by hop. A transport protocol such as TCP adds reliability and ordering when needed; the network itself can lose, delay, or reorder packets.",
    ],
    [
      /router/i,
      "A router reads a packet’s destination IP address and uses a forwarding table to choose the next hop. It connects networks; it does not need to know the entire application-level conversation. Home routers often combine routing with Wi-Fi and several other services.",
    ],
    [/internet send|web page/i, topics.internet.explanation],
  ],
  camera: [
    [
      /aperture/i,
      "The aperture is an adjustable opening in the lens. A wider opening admits more light for the same exposure time and generally gives a shallower depth of field. The f-number is focal length divided by entrance-pupil diameter, so a lower f-number means a wider relative opening.",
    ],
    [
      /shutter|exposure/i,
      "Exposure time determines how long the sensor collects light. A short exposure helps freeze movement but gathers fewer photons at a given aperture. A longer exposure gathers more light and can show motion blur.",
    ],
    [/focus|lens/i, topics.camera.parts[0][5]],
    [/sensor/i, topics.camera.parts[3][5]],
  ],
  nuclear: [
    [
      /control rod/i,
      "Control rods contain materials that absorb neutrons. Inserting them reduces the neutrons available to continue fission, helping lower power or shut down the chain reaction. Heat from radioactive decay remains after shutdown and still needs cooling.",
    ],
    [
      /cooling|condenser/i,
      "A steam power cycle needs to reject heat to a colder sink. The condenser turns turbine exhaust steam back into liquid water so it can be pumped through the cycle again. Cooling systems remove that rejected heat.",
    ],
    [/heat.*electricity|reactor.*heat|fission/i, topics.nuclear.explanation],
  ],
};

export function demoAnswer(
  node: LearningNode,
  question: string,
  componentId?: string,
  simple = false,
): TutorAnswer {
  const component = node.components.find((c) => c.id === componentId);
  if (simple) {
    const original = demoAnswer(node, question, componentId, false);
    if (original.answer.includes("does not contain a reviewed answer"))
      return original;
    if (
      node.category === "Engineering" &&
      /piston.{0,20}(move|go).{0,15}down|down.{0,20}piston/i.test(question)
    )
      return {
        ...original,
        answer:
          "The piston goes down in two different parts of the cycle. During intake, it pulls fresh air and fuel in. During the power stroke, hot gas pushes it down, helping turn the crankshaft.",
      };
    return {
      ...original,
      answer: original.answer
        .split(/(?<=[.!?])\s+/)
        .slice(0, 2)
        .join(" "),
    };
  }
  const key =
    Object.keys(topics).find((k) => topics[k].title === node.title) || "engine";
  const domain = [
    "engine",
    "piston",
    "rings",
    "cycle",
    "spark",
    "crankshaft",
  ].includes(key)
    ? "engineering"
    : key;
  const match = (answers[domain] || []).find(([re]) => re.test(question));
  if (match)
    return { answer: match[1], suggestions: node.followUps, demo: true };
  const named = node.components.find((c) =>
    question.toLowerCase().includes(c.name.toLowerCase()),
  );
  if (named)
    return {
      answer: `${named.function} ${named.details}`,
      suggestions: [named.deeperQuestion, ...node.followUps.slice(0, 2)],
      demo: true,
    };
  if (
    component &&
    /^(how does (it|this) work|what does (it|this) do|explain (it|this)|tell me more|more detail|why is (it|this))\b/i.test(
      question.trim(),
    )
  )
    return {
      answer: `${component.function} ${component.details}`,
      suggestions: [component.deeperQuestion, ...node.followUps.slice(0, 2)],
      demo: true,
    };
  if (
    /^(explain|summari[sz]e|what is this|how does (it|this) work|tell me more|make it simple)/i.test(
      question.trim(),
    )
  )
    return {
      answer: node.explanation,
      suggestions: node.followUps,
      demo: true,
    };
  return {
    answer:
      "This curated demo does not contain a reviewed answer to that question. Try one of the suggested questions or select a labeled component. Connect a learning provider for answers to new questions.",
    suggestions: node.followUps,
    demo: true,
  };
}
