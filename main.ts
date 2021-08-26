import { App, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface PodcastNoteSettings {
	podcastTemplate: string,
	newNote: boolean,
	fileName: string
}

const DEFAULT_SETTINGS: PodcastNoteSettings = {
	podcastTemplate: "# {{Title}} \n {{Image}} \n ## Description: \n {{Description}} \n ## Notes: \n",
	newNote: false,
	fileName: ""
}

export default class PodcastNote extends Plugin {

	settings: PodcastNoteSettings;

	async onload() {
		console.log('loading plugin PodcastNote');

		await this.loadSettings();

		this.addSettingTab(new PodcastNoteSettingTab(this.app, this));

		this.addCommand({
			id: 'add-podcast-note',
			name: 'Add Podcast Note',

			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						new PodcastNoteModal(this.app, this).open();
					}
					return true;
				}
				return false;
			}
		});
	}

	onunload() {
		console.log('unloading plugin PodcastNote');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}


class PodcastNoteModal extends Modal {

	plugin: PodcastNote;

	constructor(app: App, plugin: PodcastNote) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		let {contentEl} = this;
		let html = '<h3 style="margin-top: 0px;">Enter URL:</p><input type="text"/> <br><br><button>Add Podcast Note</button>';
		contentEl.innerHTML = html;

		contentEl.querySelector("button").addEventListener("click", () => {

			let url = contentEl.querySelector("input").value
			let response = this.getHttpsResponse(url);

			
				new Notice("Loading Podcast Info")
				response.then((result) => {

					try{
						let root = this.getParsedHtml(result);

						let podcastInfo = this.getMetaDataForPodcast(root, url)
						let title = podcastInfo[1]
						let podcastString = podcastInfo[0]

						if (this.plugin.settings.newNote){		
							let fileName = this.plugin.settings.fileName.replace("{{Title}}", title).replace("{{Date}}", Date.now().toString())
							this.addToNewNote(podcastString, fileName)
						} else {
							this.addAtCursor(podcastString)
						}
					}catch{
						new Notice("The URL is invalid or incomplete.")
					}
				})
			
            this.close()
		});
	}

	getHttpsResponse(url: string){

		let spotifyHost = "open.spotify.com"
		let appleHost = "podcasts.apple.com"

		let host = ""
		let podcastPath = ""

		if (url.includes(spotifyHost)){
			host = spotifyHost
			podcastPath = url.split(host)[1]
		} else if (url.includes(appleHost)){
			host = appleHost
			podcastPath = url.split(host)[1]
		} else{
			new Notice("This is not a valid URL");
		}

		const https = require('https')
		const options = {
			hostname: host,
			port: 443,
			path: podcastPath,
			method: 'GET',
			headers: { 'User-Agent': 'Mozilla/5.0' }
		}

		return new Promise((resolve, reject) => {
			https.request(options, res => {
				res.setEncoding('utf8');
				let body = ''; 
				res.on('data', chunk => body += chunk);
				res.on('end', () => resolve(body));
			}).on('error', reject).end();
		});

	}

	getParsedHtml(s){
		let parser = new DOMParser()
		let root = parser.parseFromString(s, "text/html")
		return root;
	}

	getMetaDataForPodcast(root, url){
		let title = ""
		let desc = ""
		let imageLink = ""

		title = root.querySelector("meta[property='og:title']").getAttribute('content')
		desc = root.querySelector("meta[property='og:description']").getAttribute('content')
		imageLink = root.querySelector("meta[property='og:image']").getAttribute('content')
		imageLink = "![](" + imageLink +  ")"
		let d = new Date()
		let dateString = ("0" + d.getDate()).slice(-2) + "-" + ("0"+(d.getMonth()+1)).slice(-2) + "-" + d.getFullYear() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
		let podcastLink = "[-> Podcast](" + url + ")"

		let podcastTemplate = this.plugin.settings.podcastTemplate
		podcastTemplate = podcastTemplate
							.replace("{{Title}}", title)
							.replace("{{Image}}", imageLink)
							.replace("{{Description}}", desc)
							.replace("{{Date}}", dateString)
							.replace("{{Link}}", podcastLink)

		return [podcastTemplate, title]
	}


	addAtCursor(s: string){
		let mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
        let doc = mdView.editor;
		var currentLine = doc.getCursor();
        doc.replaceRange(s, currentLine, currentLine);
	}

	addToNewNote(s: string, fileName: string){
		fileName = fileName.replace("/", "").replace("\\", "").replace(":", "").replace(":", "")
		this.app.vault
		this.app.vault.create(fileName + ".md", s);
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}
}

class PodcastNoteSettingTab extends PluginSettingTab {
	plugin: PodcastNote;

	constructor(app: App, plugin: PodcastNote) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;
		containerEl.empty();
		containerEl.createEl('h2', {text: 'Settings for Podcast Note'});



		new Setting(containerEl)
				.setName('Template')
				.setDesc("you can define your own template. Available placeholders are: {{Title}}, {{Image}}, {{Description}}, {{Link}}, {{Date}}")
				.addTextArea(textarea => textarea
					.setValue(this.plugin.settings.podcastTemplate)
					.onChange(async () => {
						this.plugin.settings.podcastTemplate = textarea.getValue();
						await this.plugin.saveSettings();
					})
				)

		new Setting(containerEl)
				.setName('New note')
				.setDesc('Create new note (default: insert at cursor)')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.newNote)
					.onChange(async () => {
						this.plugin.settings.newNote = toggle.getValue();
						await this.plugin.saveSettings();
					})
				)

		new Setting(containerEl)
				.setName('Filename template')
				.setDesc('Filename template when "New note" is selected. Available placeholders are {{Title}}, {{Date}}')
				.addTextArea(textarea => textarea
					.setValue(this.plugin.settings.fileName)
					.onChange(async () => {
						this.plugin.settings.fileName = textarea.getValue()
						await this.plugin.saveSettings()
					})
				)
	}
}