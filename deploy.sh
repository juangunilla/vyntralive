#!/bin/bash

# Live Streaming Platform Deployment Script
# Usage: ./deploy.sh [environment]
# Environment: development | production

set -e

ENVIRONMENT=${1:-development}
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting deployment for $ENVIRONMENT environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    print_success "Docker and Docker Compose are installed"
}

# Check if .env file exists
check_env() {
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Copying from .env.example..."
        cp .env.example .env
        print_error "Please edit the .env file with your actual configuration values before running this script again."
        exit 1
    fi

    print_success "Environment file found"
}

# Validate environment variables
validate_env() {
    print_status "Validating environment variables..."

    required_vars=("MONGO_ROOT_PASSWORD" "JWT_SECRET" "LIVEKIT_API_KEY" "LIVEKIT_API_SECRET")

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set"
            exit 1
        fi
    done

    print_success "Environment variables validated"
}

# Build and start services
deploy_services() {
    print_status "Building and starting services..."

    if [ "$ENVIRONMENT" = "production" ]; then
        docker-compose up -d --build
    else
        docker-compose up -d --build --scale frontend=1 --scale backend=1
    fi

    print_success "Services started successfully"
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be healthy..."

    # Wait for MongoDB
    print_status "Waiting for MongoDB..."
    docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1
    while [ $? -ne 0 ]; do
        sleep 2
        docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1
    done

    # Wait for backend
    print_status "Waiting for backend..."
    timeout=60
    counter=0
    while ! curl -f http://localhost:5000/health > /dev/null 2>&1; do
        if [ $counter -ge $timeout ]; then
            print_error "Backend failed to start within $timeout seconds"
            exit 1
        fi
        sleep 2
        counter=$((counter + 2))
    done

    # Wait for frontend
    print_status "Waiting for frontend..."
    counter=0
    while ! curl -f http://localhost:3000 > /dev/null 2>&1; do
        if [ $counter -ge $timeout ]; then
            print_error "Frontend failed to start within $timeout seconds"
            exit 1
        fi
        sleep 2
        counter=$((counter + 2))
    done

    print_success "All services are healthy"
}

# Run database migrations/initialization
init_database() {
    print_status "Initializing database..."

    # You can add database initialization scripts here
    # For example, creating indexes, initial data, etc.

    print_success "Database initialized"
}

# Show deployment status
show_status() {
    print_success "Deployment completed successfully!"
    echo ""
    echo "🌐 Services are running on:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend API: http://localhost:5000"
    echo "   MongoDB: localhost:27017"
    echo ""
    echo "📊 To check service status:"
    echo "   docker-compose ps"
    echo ""
    echo "📝 To view logs:"
    echo "   docker-compose logs -f [service-name]"
    echo ""
    echo "🛑 To stop services:"
    echo "   docker-compose down"
}

# Main deployment function
main() {
    print_status "Starting deployment process..."

    check_docker
    check_env

    # Load environment variables
    set -a
    source .env
    set +a

    validate_env
    deploy_services
    wait_for_services
    init_database
    show_status
}

# Handle command line arguments
case "$ENVIRONMENT" in
    development|production)
        main
        ;;
    *)
        print_error "Invalid environment. Use 'development' or 'production'"
        exit 1
        ;;
esac