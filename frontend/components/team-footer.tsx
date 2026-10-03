import { Github } from "lucide-react";

const team = [
  { name: "Ansh Darji", github: "AnshDarji" },
  { name: "Anadi Basson", github: "akx09" },
  { name: "Aadesh Yadav", github: "AadeshYadav26" },
  { name: "Abhiraj Kumar", github: "abhirajkumarnirala" },
];

export function TeamFooter() {
  return <section className="team-footer" aria-labelledby="team-heading">
    <div className="team-footer-heading"><span>THE TEAM</span><h2 id="team-heading">Made by</h2></div>
    <ul className="team-footer-members">
      {team.map(member => <li key={member.github}>
        <span className="team-member-name">{member.name}</span>
        <a href={`https://github.com/${member.github}`} target="_blank" rel="noopener noreferrer" aria-label={`${member.github} on GitHub (opens in a new tab)`}><Github size={16} aria-hidden="true" /><span>{member.github}</span><span aria-hidden="true">↗</span></a>
      </li>)}
    </ul>
  </section>;
}
