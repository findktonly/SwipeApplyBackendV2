import SwiftUI
import UniformTypeIdentifiers
import PDFKit

struct Job: Identifiable, Codable {
    let id: String
    let title: String
    let company: String
    let location: String
    let remoteType: String
    let experienceLevel: String
    let description: String
    let applyUrl: String
    let additionalQuestions: [String]?
}

@MainActor
class JobsViewModel: ObservableObject {
    @Published var jobs: [Job] = []
    @Published var topIndex: Int = 0
    @Published var resumeText: String = ""
    @Published var coverLetter: String = ""
    @Published var aiAnswers: [String: String] = [:]
    @Published var showModal = false
    @Published var selectedJob: Job?
    @Published var filters = (location: "Any", remote: "Any", experience: "Any", keyword: "")

    let backendBase = "http://127.0.0.1:3000" // change to your hosted backend URL

    func fetchJobs() async {
        var components = URLComponents(string: "\(backendBase)/api/jobs")!
        var queryItems = [URLQueryItem]()
        queryItems.append(URLQueryItem(name: "location", value: filters.location == "Any" ? nil : filters.location))
        queryItems.append(URLQueryItem(name: "remote", value: filters.remote == "Any" ? nil : filters.remote))
        queryItems.append(URLQueryItem(name: "experience", value: filters.experience == "Any" ? nil : filters.experience))
        queryItems.append(URLQueryItem(name: "keyword", value: filters.keyword.isEmpty ? nil : filters.keyword))
        components.queryItems = queryItems.isEmpty ? nil : queryItems

        guard let url = components.url else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let decoded = try JSONDecoder().decode([Job].self, from: data)
            DispatchQueue.main.async {
                self.jobs = decoded
                self.topIndex = 0
            }
        } catch {
            print("fetchJobs error", error)
        }
    }

    func uploadResumeAndParse(data: Data) async {
        // Send resume to backend parse endpoint
        guard let url = URL(string: "\(backendBase)/api/parseResume") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        let boundary = "Boundary-\(UUID().uuidString)"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"resume.pdf\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/pdf\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
        req.httpBody = body

        do {
            let (respData, _) = try await URLSession.shared.data(for: req)
            if let parsed = String(data: respData, encoding: .utf8) {
                DispatchQueue.main.async { self.resumeText = parsed }
            }
        } catch {
            print("upload parse error", error)
        }
    }

    func aiFillQuestions(for job: Job) async {
        guard let url = URL(string: "\(backendBase)/api/ai/fill") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let payload: [String: Any] = [
            "resume": resumeText,
            "jobDescription": job.description,
            "questions": job.additionalQuestions ?? []
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let resp = try JSONDecoder().decode([String:String].self, from: data)
            DispatchQueue.main.async {
                self.aiAnswers = resp
            }
        } catch {
            print("aiFill error", error)
        }
    }

    func submitApplication(job: Job, completion: @escaping (Bool, String?) -> Void) {
        guard let url = URL(string: "\(backendBase)/api/apply") else { completion(false, "bad url"); return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let payload: [String: Any] = [
            "jobId": job.id,
            "coverLetter": coverLetter,
            "answers": aiAnswers,
            "resumeText": resumeText
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        URLSession.shared.dataTask(with: req) { data, resp, err in
            if let err = err {
                completion(false, err.localizedDescription)
                return
            }
            completion(true, nil)
        }.resume()
    }
}

struct ContentView: View {
    @StateObject var vm = JobsViewModel()
    @State private var showingPicker = false
    @State private var pickedData: Data?

    var body: some View {
        NavigationView {
            VStack {
                HStack {
                    TextField("Location", text: Binding(get: { vm.filters.location }, set: { vm.filters.location = $0 }))
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 140)
                    TextField("Keyword", text: Binding(get: { vm.filters.keyword }, set: { vm.filters.keyword = $0 }))
                        .textFieldStyle(.roundedBorder)
                        .frame(width: 140)
                    Button("Search") {
                        Task { await vm.fetchJobs() }
                    }
                }.padding()

                ZStack {
                    if vm.jobs.isEmpty {
                        Text("No jobs loaded. Tap Search.")
                    } else {
                        ForEach(Array(vm.jobs.enumerated()), id: \.1.id) { idx, job in
                            if idx >= vm.topIndex {
                                JobCard(job: job)
                                    .offset(x: idx == vm.topIndex ? 0 : 0, y: Double(idx - vm.topIndex) * 6.0)
                                    .gesture(dragGesture(job: job))
                                    .animation(.spring(), value: vm.topIndex)
                                    .zIndex(Double(vm.jobs.count - idx))
                            }
                        }
                    }
                }.frame(height: 380)

                HStack {
                    Button("Upload Resume") { showingPicker = true }
                        .padding()
                        .background(.thinMaterial)
                        .cornerRadius(8)
                    Button("Fetch Jobs") { Task { await vm.fetchJobs() } }
                        .padding()
                        .background(.thinMaterial)
                        .cornerRadius(8)
                }

                Spacer()
            }
            .navigationTitle("SwipeApply")
            .sheet(isPresented: $showingPicker) {
                DocumentPicker { data in
                    showingPicker = false
                    if let d = data {
                        Task { await vm.uploadResumeAndParse(data: d) }
                    }
                }
            }
            .sheet(isPresented: $vm.showModal) {
                if let job = vm.selectedJob {
                    ApplyModal(vm: vm, job: job)
                } else {
                    Text("No job selected")
                }
            }
        }
    }

    func dragGesture(job: Job) -> some Gesture {
        DragGesture(minimumDistance: 10).onEnded { value in
            if value.translation.width > 120 {
                // swipe right -> apply
                Task {
                    await vm.aiFillQuestions(for: job)
                    vm.selectedJob = job
                    vm.showModal = true
                }
            } else if value.translation.width < -120 {
                // swipe left -> skip
                vm.topIndex += 1
                if vm.topIndex >= vm.jobs.count { vm.topIndex = 0 }
            }
        }
    }
}

struct JobCard: View {
    let job: Job
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(job.title).font(.title2).bold()
                Spacer()
                Text(job.remoteType.capitalized).font(.caption)
            }
            Text(job.company).font(.headline)
            Text(job.location).font(.subheadline)
            Divider()
            ScrollView {
                Text(job.description).font(.body)
            }.frame(height: 180)
            if let qs = job.additionalQuestions {
                Text("Questions: \(qs.count)").font(.caption)
            }
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 16).fill(.regularMaterial))
        .frame(width: 350, height: 340)
        .shadow(radius: 4)
    }
}

struct ApplyModal: View {
    @ObservedObject var vm: JobsViewModel
    let job: Job
    @State private var isSubmitting = false

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Applying to")) {
                    Text("\(job.title) — \(job.company)")
                    Text(job.location).font(.caption)
                }
                Section(header: Text("Cover Letter")) {
                    TextEditor(text: $vm.coverLetter).frame(minHeight: 140)
                }
                if let qs = job.additionalQuestions {
                    Section(header: Text("AI answers")) {
                        ForEach(qs, id: \.self) { q in
                            VStack(alignment: .leading) {
                                Text(q).font(.caption)
                                TextEditor(text: Binding(get: { vm.aiAnswers[q] ?? "" }, set: { vm.aiAnswers[q] = $0 }))
                                    .frame(minHeight: 80)
                            }
                        }
                    }
                }
                Section {
                    Button(action: {
                        isSubmitting = true
                        vm.submitApplication(job: job) { success, err in
                            isSubmitting = false
                            if success {
                                vm.showModal = false
                                vm.topIndex += 1
                                if vm.topIndex >= vm.jobs.count { vm.topIndex = 0 }
                            } else {
                                // handle error
                            }
                        }
                    }) {
                        HStack {
                            if isSubmitting { ProgressView() }
                            Text("Submit Application")
                        }
                    }
                }
            }
            .navigationTitle("Apply")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { vm.showModal = false }
                }
            }
        }
    }
}

struct DocumentPicker: UIViewControllerRepresentable {
    var onPicked: (Data?) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(onPicked: onPicked) }
    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let types: [UTType] = [UTType.pdf, UTType.plainText]
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}
    class Coordinator: NSObject, UIDocumentPickerDelegate {
        var onPicked: (Data?) -> Void
        init(onPicked: @escaping (Data?) -> Void) { self.onPicked = onPicked }
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first else { onPicked(nil); return }
            do { let d = try Data(contentsOf: url); onPicked(d) }
            catch { onPicked(nil) }
        }
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { onPicked(nil) }
    }
}