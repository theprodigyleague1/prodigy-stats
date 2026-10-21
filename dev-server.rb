# Local preview without Node: serves the site and forwards Superstat API calls with your keys.
# The keys stay in this process; the browser only sees placeholders like "dev:0".
# NXT, Frosh and Prep are separate Superstat clubs, so enter one key per club.
#
#   ruby dev-server.rb          (asks for the keys, input hidden)
#   open http://localhost:3000

require 'webrick'
require 'net/http'
require 'uri'
require 'io/console'

ROOT = File.expand_path(__dir__)
PORT = (ENV['PORT'] || 3000).to_i

keys = ENV['SUPERSTAT_API_KEYS'].to_s.split(',').map(&:strip).reject(&:empty?)
if keys.empty?
  puts 'Paste one Superstat API key per club (NXT, Frosh, Prep). Input is hidden.'
  loop do
    print "Key #{keys.size + 1} (press Return on an empty line when done): "
    k = STDIN.noecho(&:gets).to_s.strip
    puts
    break if k.empty?
    keys << k
  end
end
abort 'No keys entered.' if keys.empty?
puts "Using #{keys.size} key#{keys.size == 1 ? '' : 's'}."

server = WEBrick::HTTPServer.new(
  Port: PORT,
  BindAddress: '127.0.0.1',
  DocumentRoot: ROOT,
  AccessLog: [],
  Logger: WEBrick::Log.new($stderr, WEBrick::Log::WARN)
)

server.mount_proc('/__dev/ping') do |_req, res|
  res['Content-Type'] = 'application/json'
  res.body = %({"ok":true,"keys":#{keys.size}})
end

server.mount_proc('/__dev/superstat') do |req, res|
  path = req.path.sub('/__dev/superstat', '')
  unless path =~ %r{\A/v1/[A-Za-z0-9\-/]+\z}
    res.status = 400
    res.body = '{"error":"bad path"}'
    next
  end
  key = keys[req['Authorization'].to_s[/\ABearer dev:(\d+)\z/, 1].to_i]
  unless key
    res.status = 400
    res.body = '{"error":"unknown key index"}'
    next
  end
  uri = URI("https://api.superstatsport.com#{path}")
  uri.query = req.query_string if req.query_string
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  upstream = http.request(Net::HTTP::Get.new(uri, 'Authorization' => "Bearer #{key}", 'Accept' => 'application/json'))
  res.status = upstream.code.to_i
  res['Content-Type'] = upstream['content-type'] || 'application/json'
  res['Retry-After'] = upstream['retry-after'] if upstream['retry-after']
  res['Cache-Control'] = 'no-store'
  res.body = upstream.body
end

trap('INT') { server.shutdown }
puts "Leaderboard running at http://localhost:#{PORT}  (Ctrl+C to stop)"
server.start
